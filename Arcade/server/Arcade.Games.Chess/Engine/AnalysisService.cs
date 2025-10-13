using Arcade.Core.Abstractions;
using Arcade.Core.Errors;
using Arcade.Games.Chess.Domain;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Arcade.Games.Chess.Engine;

public sealed record ChessAnalysisRequest(string Fen, int? Depth);

public sealed record ChessAnalysisResponse(string BestMove, int? Centipawns, int? Mate, IReadOnlyList<string> PrincipalVariation);

public sealed class AnalysisService : IAnalysisService<ChessAnalysisRequest, ChessAnalysisResponse>
{
    private readonly StockfishEngine _engine;
    private readonly ChessOptions _options;
    private readonly ILogger<AnalysisService> _logger;

    public AnalysisService(StockfishEngine engine, IOptions<ChessOptions> options, ILogger<AnalysisService> logger)
    {
        _engine = engine;
        _options = options.Value;
        _logger = logger;
    }

    public async ValueTask<ChessAnalysisResponse> AnalyzeAsync(ChessAnalysisRequest request, CancellationToken cancellationToken = default)
    {
        var depth = request.Depth ?? _options.DefaultDepth;
        _logger.LogInformation("Starte Analyse für FEN {Fen} mit Tiefe {Depth}", request.Fen, depth);

        try
        {
            var response = await _engine.ExecuteAsync(new StockfishRequest(request.Fen, depth), cancellationToken).ConfigureAwait(false);
            return new ChessAnalysisResponse(response.BestMove, response.Centipawns, response.Mate, response.PrincipalVariation);
        }
        catch (EngineUnavailableException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Analyse fehlgeschlagen");
            throw new EngineUnavailableException("Stockfish ist nicht verfügbar.", ex);
        }
    }
}
