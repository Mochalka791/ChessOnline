using Arcade.Core.Errors;
using Arcade.Games.Sudoku.Engine;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Arcade.Games.Sudoku.Api;

public static class SudokuEndpoints
{
    public static RouteGroupBuilder MapSudokuEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/new", (SudokuEngine engine, SudokuRoomRequest request) => TypedResults.Ok(engine.Create(request.RoomId)));
        group.MapPost("/validate", (SudokuEngine engine, SudokuValidateRequest request) =>
        {
            try
            {
                return Results.Ok(engine.Validate(request.RoomId, request.Row, request.Column, request.Value));
            }
            catch (InvalidMoveException ex)
            {
                return Results.BadRequest(new ProblemDetails { Title = "Ungültiger Zug", Detail = ex.Message });
            }
        });
        group.MapPost("/reset", (SudokuEngine engine, SudokuRoomRequest request) => TypedResults.Ok(engine.Reset(request.RoomId)));
        group.MapGet("/state", (SudokuEngine engine, [AsParameters] SudokuRoomRequest request) =>
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

public sealed record SudokuRoomRequest(string RoomId);

public sealed record SudokuValidateRequest(string RoomId, int Row, int Column, int Value);
