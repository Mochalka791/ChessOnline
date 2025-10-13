using Arcade.Games.Blockwood.Engine;
using Xunit;

namespace Arcade.Games.Blockwood.Tests;

public sealed class BlockwoodEngineTests
{
    [Fact]
    public void Move_Increments_Count()
    {
        var engine = new BlockwoodEngine();
        var state = engine.Create(null);
        state = engine.Move(state.GameId.Value);
        Assert.Equal(1, state.Moves);
    }

    [Fact]
    public void Reset_Returns_ZeroMoves()
    {
        var engine = new BlockwoodEngine();
        var state = engine.Create(null);
        state = engine.Move(state.GameId.Value);
        state = engine.Reset(state.GameId.Value);
        Assert.Equal(0, state.Moves);
    }
}
