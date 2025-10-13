using Arcade.Games.Chess.Domain;
using Arcade.Games.Chess.Engine;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Arcade.Games.Chess.Api;

public static class DevEndpoints
{
    public static RouteGroupBuilder MapDevChessEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/force-win", (ChessGameManager manager, DevRequest request) => TypedResults.Ok(manager.ForceWin(request.RoomId)));
        group.MapPost("/force-lose", (ChessGameManager manager, DevRequest request) => TypedResults.Ok(manager.ForceLose(request.RoomId)));
        group.MapPost("/force-draw", (ChessGameManager manager, DevRequest request) => TypedResults.Ok(manager.ForceDraw(request.RoomId)));
        group.MapPost("/reset", (ChessGameManager manager, DevRequest request) =>
        {
            manager.Reset(request.RoomId);
            return TypedResults.NoContent();
        });
        group.MapGet("/analyze", async (ChessGameManager manager, AnalysisService analysis, [AsParameters] ChessAnalysisRequestDto request, CancellationToken ct) =>
        {
            var state = manager.GetState(request.RoomId);
            var result = await analysis.AnalyzeAsync(new ChessAnalysisRequest(state.Fen, request.Depth), ct).ConfigureAwait(false);
            return TypedResults.Ok(result);
        });

        return group;
    }
}

public sealed record DevRequest(string RoomId);
