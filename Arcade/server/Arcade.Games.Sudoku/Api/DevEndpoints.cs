using Arcade.Games.Sudoku.Engine;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Arcade.Games.Sudoku.Api;

public static class SudokuDevEndpoints
{
    public static RouteGroupBuilder MapSudokuDevEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/force-win", (SudokuEngine engine, SudokuRoomRequest request) => TypedResults.Ok(engine.ForceWin(request.RoomId)));
        group.MapPost("/force-lose", (SudokuEngine engine, SudokuRoomRequest request) => TypedResults.Ok(engine.ForceLose(request.RoomId)));
        group.MapPost("/force-draw", (SudokuEngine engine, SudokuRoomRequest request) => TypedResults.Ok(engine.ForceDraw(request.RoomId)));
        group.MapPost("/reset", (SudokuEngine engine, SudokuRoomRequest request) => TypedResults.Ok(engine.Reset(request.RoomId)));
        return group;
    }
}
