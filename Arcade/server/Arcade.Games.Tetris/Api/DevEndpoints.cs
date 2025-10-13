using Arcade.Games.Tetris.Engine;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Arcade.Games.Tetris.Api;

public static class TetrisDevEndpoints
{
    public static RouteGroupBuilder MapTetrisDevEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/force-win", (TetrisEngine engine, TetrisRoomRequest request) => TypedResults.Ok(engine.ForceWin(request.RoomId)));
        group.MapPost("/force-lose", (TetrisEngine engine, TetrisRoomRequest request) => TypedResults.Ok(engine.ForceLose(request.RoomId)));
        group.MapPost("/force-draw", (TetrisEngine engine, TetrisRoomRequest request) => TypedResults.Ok(engine.ForceDraw(request.RoomId)));
        group.MapPost("/reset", (TetrisEngine engine, TetrisRoomRequest request) => TypedResults.Ok(engine.Reset(request.RoomId)));
        return group;
    }
}
