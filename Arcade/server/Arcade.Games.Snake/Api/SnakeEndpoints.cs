using Arcade.Core.Errors;
using Arcade.Games.Snake.Domain;
using Arcade.Games.Snake.Engine;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Arcade.Games.Snake.Api;

public static class SnakeEndpoints
{
    public static RouteGroupBuilder MapSnakeEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/new", (SnakeEngine engine, SnakeNewRequest request) => TypedResults.Ok(engine.Create(request.RoomId)));
        group.MapPost("/move", (SnakeEngine engine, SnakeMoveRequest request) =>
        {
            try
            {
                var state = engine.Move(request.RoomId, request.Direction);
                return Results.Ok(state);
            }
            catch (InvalidMoveException ex)
            {
                return Results.BadRequest(new ProblemDetails { Title = "Ungültiger Raum", Detail = ex.Message });
            }
        });
        group.MapPost("/reset", (SnakeEngine engine, SnakeResetRequest request) => TypedResults.Ok(engine.Reset(request.RoomId)));
        group.MapGet("/state", (SnakeEngine engine, [AsParameters] SnakeStateRequest request) =>
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

public sealed record SnakeNewRequest(string? RoomId);

public sealed record SnakeMoveRequest(string RoomId, SnakeDirection Direction);

public sealed record SnakeResetRequest(string RoomId);

public sealed record SnakeStateRequest(string RoomId);
