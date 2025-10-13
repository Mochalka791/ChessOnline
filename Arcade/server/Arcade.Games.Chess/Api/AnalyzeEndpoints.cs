using Arcade.Core.Errors;
using Arcade.Games.Chess.Domain;
using Arcade.Games.Chess.Engine;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Arcade.Games.Chess.Api;

public static class AnalyzeEndpoints
{
    public static RouteGroupBuilder MapAnalyzeEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/analyze", AnalyzeAsync);
        return group;
    }

    private static async Task<Results<Ok<ChessAnalysisResponse>, BadRequest<ProblemDetails>>> AnalyzeAsync(
        ChessGameManager manager,
        AnalysisService analysis,
        [AsParameters] ChessAnalysisRequestDto request,
        CancellationToken cancellationToken)
    {
        if (request.Depth is < 4 or > 30)
        {
            return TypedResults.BadRequest(new ProblemDetails
            {
                Title = "Ungültige Tiefe",
                Detail = "Die Tiefe muss zwischen 4 und 30 liegen.",
                Status = StatusCodes.Status400BadRequest
            });
        }

        try
        {
            var state = manager.GetState(request.RoomId);
            var response = await analysis.AnalyzeAsync(new ChessAnalysisRequest(state.Fen, request.Depth), cancellationToken)
                .ConfigureAwait(false);
            return TypedResults.Ok(response);
        }
        catch (InvalidMoveException ex)
        {
            return TypedResults.BadRequest(new ProblemDetails
            {
                Title = "Analyse nicht möglich",
                Detail = ex.Message,
                Status = StatusCodes.Status400BadRequest
            });
        }
        catch (EngineUnavailableException ex)
        {
            return TypedResults.BadRequest(new ProblemDetails
            {
                Title = "Engine nicht verfügbar",
                Detail = ex.Message,
                Status = StatusCodes.Status503ServiceUnavailable
            });
        }
    }
}

public sealed record ChessAnalysisRequestDto(string RoomId, int Depth);
