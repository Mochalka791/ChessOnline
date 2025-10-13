using Arcade.Core.Errors;
using Arcade.Games.Minesweeper.Engine;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Arcade.Games.Minesweeper.Api;

public static class MinesweeperEndpoints
{
    public static RouteGroupBuilder MapMinesweeperEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/new", (MinesweeperEngine engine, MinesweeperRoomRequest request) => TypedResults.Ok(engine.Create(request.RoomId)));
        group.MapPost("/reveal", (MinesweeperEngine engine, MinesweeperRevealRequest request) =>
        {
            try
            {
                return Results.Ok(engine.Reveal(request.RoomId, request.Row, request.Column));
            }
            catch (InvalidMoveException ex)
            {
                return Results.BadRequest(new ProblemDetails { Title = "Ungültiger Zug", Detail = ex.Message });
            }
        });
        group.MapPost("/reset", (MinesweeperEngine engine, MinesweeperRoomRequest request) => TypedResults.Ok(engine.Reset(request.RoomId)));
        group.MapGet("/state", (MinesweeperEngine engine, [AsParameters] MinesweeperRoomRequest request) =>
        {
            try
            {
                return Results.Ok(engine.GetState(request.RoomId));
            }
            catch (InvalidMoveException)
            {
                return Results.NotFound();
            }
        });

        return group;
    }
}

public sealed record MinesweeperRoomRequest(string RoomId);

public sealed record MinesweeperRevealRequest(string RoomId, int Row, int Column);
