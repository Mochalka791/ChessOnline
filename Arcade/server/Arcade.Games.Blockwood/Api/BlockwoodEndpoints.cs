using Arcade.Core.Errors;
using Arcade.Games.Blockwood.Engine;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Arcade.Games.Blockwood.Api;

public static class BlockwoodEndpoints
{
    public static RouteGroupBuilder MapBlockwoodEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/new", (BlockwoodEngine engine, BlockwoodRoomRequest request) => TypedResults.Ok(engine.Create(request.RoomId)));
        group.MapPost("/move", (BlockwoodEngine engine, BlockwoodRoomRequest request) =>
        {
            try
            {
                return Results.Ok(engine.Move(request.RoomId));
            }
            catch (InvalidMoveException ex)
            {
                return Results.BadRequest(new ProblemDetails { Title = "Ungültiger Raum", Detail = ex.Message });
            }
        });
        group.MapPost("/reset", (BlockwoodEngine engine, BlockwoodRoomRequest request) => TypedResults.Ok(engine.Reset(request.RoomId)));
        group.MapGet("/state", (BlockwoodEngine engine, [AsParameters] BlockwoodRoomRequest request) =>
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

public sealed record BlockwoodRoomRequest(string RoomId);
