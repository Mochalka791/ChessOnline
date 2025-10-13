using Arcade.Games.Snake.Engine;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Arcade.Games.Snake.Api;

public static class SnakeDevEndpoints
{
    public static RouteGroupBuilder MapSnakeDevEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/force-win", (SnakeEngine engine, SnakeRoomRequest request) => TypedResults.Ok(engine.ForceWin(request.RoomId)));
        group.MapPost("/force-lose", (SnakeEngine engine, SnakeRoomRequest request) => TypedResults.Ok(engine.ForceLose(request.RoomId)));
        group.MapPost("/force-draw", (SnakeEngine engine, SnakeRoomRequest request) => TypedResults.Ok(engine.ForceDraw(request.RoomId)));
        group.MapPost("/reset", (SnakeEngine engine, SnakeRoomRequest request) => TypedResults.Ok(engine.Reset(request.RoomId)));
        return group;
    }
}

public sealed record SnakeRoomRequest(string RoomId);
