using Arcade.Games.Minesweeper.Engine;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Arcade.Games.Minesweeper.Api;

public static class MinesweeperDevEndpoints
{
    public static RouteGroupBuilder MapMinesweeperDevEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/force-win", (MinesweeperEngine engine, MinesweeperRoomRequest request) => TypedResults.Ok(engine.ForceWin(request.RoomId)));
        group.MapPost("/force-lose", (MinesweeperEngine engine, MinesweeperRoomRequest request) => TypedResults.Ok(engine.ForceLose(request.RoomId)));
        group.MapPost("/force-draw", (MinesweeperEngine engine, MinesweeperRoomRequest request) => TypedResults.Ok(engine.ForceDraw(request.RoomId)));
        group.MapPost("/reset", (MinesweeperEngine engine, MinesweeperRoomRequest request) => TypedResults.Ok(engine.Reset(request.RoomId)));
        return group;
    }
}
