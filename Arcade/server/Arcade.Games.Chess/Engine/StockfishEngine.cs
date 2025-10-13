using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text;
using Arcade.Core.Abstractions;
using Arcade.Core.Errors;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Arcade.Games.Chess.Engine;

public sealed class StockfishEngine : IGameEngine<StockfishRequest, StockfishResponse>, IAsyncDisposable
{
    private readonly ILogger<StockfishEngine> _logger;
    private readonly ChessOptions _options;
    private readonly SemaphoreSlim _semaphore = new(1, 1);
    private Process? _process;
    private StreamWriter? _input;
    private StreamReader? _output;
    private bool _isReady;

    public StockfishEngine(ILogger<StockfishEngine> logger, IOptions<ChessOptions> options)
    {
        _logger = logger;
        _options = options.Value;
    }

    public async ValueTask<StockfishResponse> ExecuteAsync(StockfishRequest command, CancellationToken cancellationToken = default)
    {
        await _semaphore.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            await EnsureReadyAsync(cancellationToken).ConfigureAwait(false);
            await SendAsync($"position fen {command.Fen}", cancellationToken).ConfigureAwait(false);
            await SendAsync($"go depth {command.Depth}", cancellationToken).ConfigureAwait(false);
            return await ReadBestMoveAsync(cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            _semaphore.Release();
        }
    }

    private async Task EnsureReadyAsync(CancellationToken cancellationToken)
    {
        if (_process is { HasExited: false } && _isReady)
        {
            return;
        }

        await BootstrapAsync(cancellationToken).ConfigureAwait(false);
        await SendAsync("uci", cancellationToken).ConfigureAwait(false);
        await WaitForAsync("uciok", _options.BootTimeoutMs, cancellationToken).ConfigureAwait(false);
        await SendAsync("isready", cancellationToken).ConfigureAwait(false);
        await WaitForAsync("readyok", _options.ReadyTimeoutMs, cancellationToken).ConfigureAwait(false);
        _isReady = true;
    }

    private async Task BootstrapAsync(CancellationToken cancellationToken)
    {
        if (_process is { HasExited: false })
        {
            return;
        }

        _logger.LogInformation("Starte Stockfish unter {Path}", _options.StockfishPath);

        try
        {
            _process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = _options.StockfishPath,
                    UseShellExecute = false,
                    RedirectStandardInput = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                }
            };

            if (!_process.Start())
            {
                throw new EngineUnavailableException($"Stockfish konnte nicht gestartet werden ({_options.StockfishPath}).");
            }

            _input = _process.StandardInput;
            _output = _process.StandardOutput;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Stockfish-Start fehlgeschlagen");
            throw new EngineUnavailableException($"Stockfish konnte nicht gestartet werden ({_options.StockfishPath}).", ex);
        }
    }

    private async Task SendAsync(string line, CancellationToken cancellationToken)
    {
        if (_input is null)
        {
            throw new InvalidOperationException("Engine nicht initialisiert.");
        }

        _logger.LogDebug("UCI → {Command}", line);
        await _input.WriteLineAsync(line.AsMemory(), cancellationToken).ConfigureAwait(false);
        await _input.FlushAsync().ConfigureAwait(false);
    }

    private async Task WaitForAsync(string token, int timeoutMs, CancellationToken cancellationToken)
    {
        if (_output is null)
        {
            throw new InvalidOperationException("Engine nicht initialisiert.");
        }

        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        linkedCts.CancelAfter(TimeSpan.FromMilliseconds(timeoutMs));

        while (!linkedCts.IsCancellationRequested)
        {
            var line = await _output.ReadLineAsync().WaitAsync(linkedCts.Token).ConfigureAwait(false);
            if (line is null)
            {
                throw new EngineUnavailableException("Stockfish antwortet nicht mehr.");
            }

            _logger.LogDebug("UCI ← {Line}", line);
            if (line.Contains(token, StringComparison.OrdinalIgnoreCase))
            {
                return;
            }
        }

        throw new TimeoutException($"Warten auf '{token}' hat {_options.BootTimeoutMs} ms überschritten.");
    }

    private async Task<StockfishResponse> ReadBestMoveAsync(CancellationToken cancellationToken)
    {
        if (_output is null)
        {
            throw new InvalidOperationException("Engine nicht initialisiert.");
        }

        var pv = new List<string>();
        int? centipawns = null;
        int? mate = null;

        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        linkedCts.CancelAfter(TimeSpan.FromMilliseconds(_options.SearchTimeoutMs));

        while (!linkedCts.IsCancellationRequested)
        {
            var line = await _output.ReadLineAsync().WaitAsync(linkedCts.Token).ConfigureAwait(false);
            if (line is null)
            {
                throw new EngineUnavailableException("Stockfish antwortet nicht mehr.");
            }

            _logger.LogDebug("UCI ← {Line}", line);
            if (line.StartsWith("info", StringComparison.OrdinalIgnoreCase))
            {
                ParseInfo(line, ref centipawns, ref mate, pv);
            }
            else if (line.StartsWith("bestmove", StringComparison.OrdinalIgnoreCase))
            {
                var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                var bestMove = parts.Length > 1 ? parts[1] : "(none)";
                _logger.LogInformation("Stockfish-Bewertung: {BestMove} cp={Centipawns} mate={Mate}", bestMove, centipawns, mate);
                return new StockfishResponse(bestMove, centipawns, mate, pv);
            }
        }

        throw new TimeoutException("Stockfish lieferte keinen bestmove innerhalb der Zeit.");
    }

    private static void ParseInfo(string line, ref int? centipawns, ref int? mate, List<string> pv)
    {
        var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        for (var i = 0; i < parts.Length; i++)
        {
            if (parts[i] == "score" && i + 2 < parts.Length)
            {
                if (parts[i + 1] == "cp" && int.TryParse(parts[i + 2], out var cp))
                {
                    centipawns = cp;
                }
                else if (parts[i + 1] == "mate" && int.TryParse(parts[i + 2], out var mateValue))
                {
                    mate = mateValue;
                }
            }
            else if (parts[i] == "pv")
            {
                pv.Clear();
                for (var j = i + 1; j < parts.Length; j++)
                {
                    pv.Add(parts[j]);
                }
                break;
            }
        }
    }

    public async ValueTask DisposeAsync()
    {
        await _semaphore.WaitAsync().ConfigureAwait(false);
        try
        {
            if (_process is { HasExited: false })
            {
                await SendAsync("quit", CancellationToken.None).ConfigureAwait(false);
                if (!_process.WaitForExit(1000))
                {
                    _process.Kill(entireProcessTree: true);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Fehler beim Beenden von Stockfish");
        }
        finally
        {
            _process?.Dispose();
            _input?.Dispose();
            _output?.Dispose();
            _process = null;
            _input = null;
            _output = null;
            _isReady = false;
            _semaphore.Release();
        }
    }
}
