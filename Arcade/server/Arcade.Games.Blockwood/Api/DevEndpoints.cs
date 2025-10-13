using Arcade.Games.Blockwood.Engine;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Arcade.Games.Blockwood.Api;

public static class BlockwoodDevEndpoints
{
    public static RouteGroupBuilder MapBlockwoodDevEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/force-win", (BlockwoodEngine engine, BlockwoodRoomRequest request) => TypedResults.Ok(engine.ForceWin(request.RoomId)));
        group.MapPost("/force-lose", (BlockwoodEngine engine, BlockwoodRoomRequest request) => TypedResults.Ok(engine.ForceLose(request.RoomId)));
        group.MapPost("/force-draw", (BlockwoodEngine engine, BlockwoodRoomRequest request) => TypedResults.Ok(engine.ForceDraw(request.RoomId)));
        group.MapPost("/reset", (BlockwoodEngine engine, BlockwoodRoomRequest request) => TypedResults.Ok(engine.Reset(request.RoomId)));
        return group;
    }
}
