using Arcade.Core.Errors;
using Arcade.Games.Chess.Domain;
using Arcade.Games.Chess.Engine;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Arcade.Games.Chess.Api;

public static class ChessEndpoints
{
    public static RouteGroupBuilder MapChessEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/new", CreateGame);
        group.MapPost("/move", ApplyMove);
        group.MapGet("/state", GetState);
        return group;
    }

    private static Ok<ChessState> CreateGame(ChessGameManager manager, ChessCreateRequest request)
    {
        var state = manager.Create(request.RoomId);
        return TypedResults.Ok(state);
    }

    private static Results<Ok<ChessState>, BadRequest<ProblemDetails>> ApplyMove(ChessGameManager manager, ChessMoveRequest request)
    {
        try
        {
            var move = ChessMove.FromAlgebraic(request.Move);
            var state = manager.ApplyMove(request.RoomId, move);
            return TypedResults.Ok(state);
        }
        catch (InvalidMoveException ex)
        {
            return TypedResults.BadRequest(new ProblemDetails
            {
                Title = "Ungültiger Zug",
                Detail = ex.Message,
                Status = StatusCodes.Status400BadRequest
            });
        }
    }

    private static Results<Ok<ChessState>, NotFound> GetState(ChessGameManager manager, [AsParameters] ChessStateRequest request)
    {
        try
        {
            var state = manager.GetState(request.RoomId);
            return TypedResults.Ok(state);
        }
        catch (InvalidMoveException)
        {
            return TypedResults.NotFound();
        }
    }
}

public sealed record ChessCreateRequest(string? RoomId);

public sealed record ChessMoveRequest(string RoomId, string Move);

public sealed record ChessStateRequest(string RoomId);
