using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;

namespace ChessOnline;

public sealed class StockfishEngine : IAsyncDisposable
{
    private readonly string _exePath;
    private Process? _proc;
    private StreamWriter? _stdin;
    private StreamReader? _stdout;
    private readonly object _lock = new();

    public StockfishEngine(IWebHostEnvironment env)
    {
        // путь: <contentRoot>/engines/stockfish/stockfish.exe
        _exePath = Path.Combine(env.ContentRootPath, "engines", "stockfish", "stockfish.exe");
    }

    private async Task EnsureStartedAsync()
    {
        if (_proc is { HasExited: false }) return;
        if (!File.Exists(_exePath))
            throw new FileNotFoundException("Stockfish executable not found", _exePath);

        var si = new ProcessStartInfo
        {
            FileName = _exePath,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        _proc = Process.Start(si) ?? throw new Exception("Failed to start stockfish");
        _stdin = _proc.StandardInput;
        _stdout = _proc.StandardOutput;

        await SendAsync("uci");
        await WaitForAsync("uciok", 5000);

        // Пара полезных опций
        await SendAsync("setoption name Threads value 2");
        await SendAsync("setoption name Hash value 64");
        await SendAsync("isready");
        await WaitForAsync("readyok", 5000);
    }

    private Task SendAsync(string cmd)
    {
        if (_stdin is null) throw new InvalidOperationException("Engine not started");
        // lock на stdin, чтобы не смешивать команды
        lock (_lock) { _stdin.WriteLine(cmd); _stdin.Flush(); }
        return Task.CompletedTask;
    }

    private async Task WaitForAsync(string token, int timeoutMs)
    {
        if (_stdout is null) throw new InvalidOperationException("Engine not started");
        var sw = Stopwatch.StartNew();
        while (sw.ElapsedMilliseconds < timeoutMs)
        {
            var line = await _stdout.ReadLineAsync();
            if (line == null) throw new Exception("Engine closed");
            if (line.Contains(token)) return;
        }
        throw new TimeoutException($"Timeout waiting for '{token}'");
    }

    public sealed record EngineEval(string BestMove, string Pv, string ScoreType, int Score, int Depth);

    public async Task<EngineEval> AnalyzeAsync(string uciMoves, int depth = 14, CancellationToken ct = default)
    {
        await EnsureStartedAsync();
        if (_stdout is null) throw new InvalidOperationException("Engine not started");

        // позиция
        await SendAsync(string.IsNullOrWhiteSpace(uciMoves)
            ? "position startpos"
            : $"position startpos moves {uciMoves}");

        // запуск поиска
        await SendAsync($"go depth {depth}");

        string? best = null;
        string pv = "";
        string scoreType = "cp";
        int score = 0;
        int lastDepth = 0;

        // регулярки для парсинга строк "info ..."
        var reCp = new Regex(@"\bscore cp (-?\d+)\b", RegexOptions.Compiled);
        var reMate = new Regex(@"\bscore mate (-?\d+)\b", RegexOptions.Compiled);
        var rePv = new Regex(@"\bpv (.+)$", RegexOptions.Compiled);
        var reDep = new Regex(@"\bdepth (\d+)\b", RegexOptions.Compiled);

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromSeconds(20));

        while (!cts.IsCancellationRequested)
        {
            var line = await _stdout.ReadLineAsync();
            if (line == null) break;

            if (line.StartsWith("info "))
            {
                var mMate = reMate.Match(line);
                var mCp = reCp.Match(line);
                var mPv = rePv.Match(line);
                var mDep = reDep.Match(line);

                if (mDep.Success) lastDepth = int.Parse(mDep.Groups[1].Value);

                if (mMate.Success)
                {
                    scoreType = "mate";
                    score = int.Parse(mMate.Groups[1].Value); // мат в N (знак важен)
                }
                else if (mCp.Success)
                {
                    scoreType = "cp";
                    score = int.Parse(mCp.Groups[1].Value);
                }

                if (mPv.Success)
                {
                    pv = mPv.Groups[1].Value.Trim();
                }
            }
            else if (line.StartsWith("bestmove "))
            {
                best = line.Split(' ')[1];
                break;
            }
        }

        best ??= "(none)";
        return new EngineEval(best, pv, scoreType, score, lastDepth);
    }

    public async ValueTask DisposeAsync()
    {
        try
        {
            if (_proc is { HasExited: false })
            {
                await SendAsync("quit");
                if (!_proc.WaitForExit(500)) _proc.Kill(true);
            }
        }
        catch { /* ignore */ }
    }
}
