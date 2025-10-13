using Arcade.Core.Errors;
using Arcade.Games.Tetris.Engine;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Arcade.Games.Tetris.Api;

public static class TetrisEndpoints
{
    public static RouteGroupBuilder MapTetrisEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/new", (TetrisEngine engine, TetrisRoomRequest request) => TypedResults.Ok(engine.Create(request.RoomId)));
        group.MapPost("/tick", (TetrisEngine engine, TetrisRoomRequest request) => TypedResults.Ok(engine.Tick(request.RoomId)));
        group.MapPost("/move", (TetrisEngine engine, TetrisMoveRequest request) =>
        {
            try
            {
                return Results.Ok(engine.Move(request.RoomId, request.Action));
            }
            catch (InvalidMoveException ex)
            {
                return Results.BadRequest(new ProblemDetails { Title = "Ungültiger Raum", Detail = ex.Message });
            }
        });
        group.MapPost("/reset", (TetrisEngine engine, TetrisRoomRequest request) => TypedResults.Ok(engine.Reset(request.RoomId)));
        group.MapGet("/state", (TetrisEngine engine, [AsParameters] TetrisRoomRequest request) =>
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

public sealed record TetrisRoomRequest(string RoomId);

public sealed record TetrisMoveRequest(string RoomId, string Action);
