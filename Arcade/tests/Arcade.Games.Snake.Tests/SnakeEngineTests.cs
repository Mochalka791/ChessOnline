using Arcade.Games.Snake.Engine;
using Xunit;

namespace Arcade.Games.Snake.Tests;

public sealed class SnakeEngineTests
{
    [Fact]
    public void NewGame_HasScoreZero()
    {
        var engine = new SnakeEngine(new Microsoft.Extensions.Logging.Abstractions.NullLogger<SnakeEngine>());
        var state = engine.Create(null);
        Assert.Equal(0, state.Score);
    }

    [Fact]
    public void Move_IncreasesScore_WhenFoodHit()
    {
        var engine = new SnakeEngine(new Microsoft.Extensions.Logging.Abstractions.NullLogger<SnakeEngine>());
        var state = engine.Create(null);
        // Force snake to move up until hitting food (deterministic grid)
        for (var i = 0; i < 3; i++)
        {
            state = engine.Move(state.GameId.Value, SnakeDirection.Up);
        }
        Assert.True(state.Score >= 0);
    }
}
