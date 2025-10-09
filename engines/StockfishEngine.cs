using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace ChessOnline;

public sealed class StockfishEngine : IAsyncDisposable
{
    private readonly string _exePath;
    private readonly bool _checkExists;
    private Process? _proc;
    private StreamWriter? _stdin;
    private StreamReader? _stdout;
    private readonly object _lock = new();
    private readonly SemaphoreSlim _startLock = new(1, 1);
    private readonly SemaphoreSlim _analyzeLock = new(1, 1);

    public StockfishEngine(IWebHostEnvironment env)
    {
        var (path, mustExist) = ResolveExecutable(env.ContentRootPath);
        _exePath = path;
        _checkExists = mustExist;
    }

    private async Task EnsureStartedAsync()
    {
        if (_proc is { HasExited: false }) return;

        await _startLock.WaitAsync().ConfigureAwait(false);
        try
        {
            if (_proc is { HasExited: false }) return;

            if (_checkExists && !File.Exists(_exePath))
                throw new FileNotFoundException("Stockfish executable not found", _exePath);

            var si = new ProcessStartInfo
            {
                FileName = _exePath,
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = GetWorkingDirectory()
            };

            try
            {
                _proc = Process.Start(si) ?? throw new Exception("Failed to start stockfish");
            }
            catch (Win32Exception ex) when (ex.NativeErrorCode == 2 || ex.NativeErrorCode == 13)
            {
                throw new FileNotFoundException(
                    "Unable to start Stockfish. Install it system-wide or set STOCKFISH_PATH to the executable.",
                    _exePath,
                    ex);
            }

            _stdin = _proc.StandardInput;
            _stdout = _proc.StandardOutput;

            await SendAsync("uci").ConfigureAwait(false);
            await WaitForAsync("uciok", 5000).ConfigureAwait(false);

            // Пара полезных опций
            await SendAsync("setoption name Threads value 2").ConfigureAwait(false);
            await SendAsync("setoption name Hash value 64").ConfigureAwait(false);
            await SendAsync("isready").ConfigureAwait(false);
            await WaitForAsync("readyok", 5000).ConfigureAwait(false);
        }
        finally
        {
            _startLock.Release();
        }
    }

    private string? GetWorkingDirectory()
    {
        if (Path.IsPathRooted(_exePath))
        {
            var dir = Path.GetDirectoryName(_exePath);
            if (!string.IsNullOrEmpty(dir) && Directory.Exists(dir))
                return dir;
        }
        return null;
    }

    private static (string Path, bool MustExist) ResolveExecutable(string contentRoot)
    {
        var overridePath = Environment.GetEnvironmentVariable("STOCKFISH_PATH");
        if (!string.IsNullOrWhiteSpace(overridePath))
        {
            var full = Path.GetFullPath(overridePath);
            return (full, true);
        }

        var enginesDir = Path.Combine(contentRoot, "engines", "stockfish");

        foreach (var candidate in EnumerateBundledBinaries(enginesDir))
        {
            if (File.Exists(candidate))
                return (candidate, true);
        }

        if (TryFindOnPath(GetPlatformExecutableName(), out var fromPath))
            return (fromPath, true);

        // В этом случае попробуем положиться на PATH при запуске процесса и покажем
        // понятную ошибку, если запуск не удался.
        return (GetPlatformExecutableName(), false);
    }

    private static IEnumerable<string> EnumerateBundledBinaries(string enginesDir)
    {
        var names = RuntimeInformation.IsOSPlatform(OSPlatform.Windows)
            ? new[]
            {
                "stockfish.exe",
                "stockfish-windows-x86-64-avx2.exe"
            }
            : new[]
            {
                "stockfish",
                "stockfish-x86-64",
                "stockfish-x86-64-modern",
                "stockfish-linux",
                "stockfish-linux-x86-64"
            };

        foreach (var name in names)
            yield return Path.Combine(enginesDir, name);
    }

    private static bool TryFindOnPath(string executableName, out string fullPath)
    {
        var paths = (Environment.GetEnvironmentVariable("PATH") ?? string.Empty)
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries);

        foreach (var p in paths)
        {
            try
            {
                var candidate = Path.Combine(p, executableName);
                if (File.Exists(candidate))
                {
                    fullPath = candidate;
                    return true;
                }
            }
            catch
            {
                // Игнорируем недоступные директории PATH
            }
        }

        fullPath = string.Empty;
        return false;
    }

    private static string GetPlatformExecutableName() =>
        RuntimeInformation.IsOSPlatform(OSPlatform.Windows) ? "stockfish.exe" : "stockfish";

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
        await EnsureStartedAsync().ConfigureAwait(false);
        if (_stdout is null) throw new InvalidOperationException("Engine not started");

        await _analyzeLock.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            // позиция
            await SendAsync(string.IsNullOrWhiteSpace(uciMoves)
                ? "position startpos"
                : $"position startpos moves {uciMoves}").ConfigureAwait(false);

            // запуск поиска
            await SendAsync($"go depth {depth}").ConfigureAwait(false);

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

            var wasCancelled = false;
            while (!cts.IsCancellationRequested)
            {
                string? line;
                try
                {
                    line = await ReadLineAsync(_stdout, cts.Token).ConfigureAwait(false);
                }
                catch (OperationCanceledException)
                {
                    wasCancelled = true;
                    break;
                }
                if (line is null) break;

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
            if (cts.IsCancellationRequested)
            {
                await SendAsync("stop").ConfigureAwait(false);
                if (ct.IsCancellationRequested && wasCancelled)
                    throw new OperationCanceledException(ct);
                throw new TimeoutException("Stockfish analysis timed out");
            }

            best ??= "(none)";
            return new EngineEval(best, pv, scoreType, score, lastDepth);
        }
        finally
        {
            _analyzeLock.Release();
        }
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
        finally
        {
            _stdin?.Dispose();
            _stdout?.Dispose();
            _proc?.Dispose();
            _stdin = null;
            _stdout = null;
            _proc = null;
        }
    }

    private static async Task<string?> ReadLineAsync(StreamReader reader, CancellationToken token)
    {
        var readTask = reader.ReadLineAsync();
        var completed = await Task.WhenAny(readTask, Task.Delay(Timeout.Infinite, token)).ConfigureAwait(false);
        if (completed != readTask)
            throw new OperationCanceledException(token);
        return await readTask.ConfigureAwait(false);
    }
}
