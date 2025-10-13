using Arcade.Games.Minesweeper.Engine;
using Xunit;

namespace Arcade.Games.Minesweeper.Tests;

public sealed class MinesweeperEngineTests
{
    [Fact]
    public void Create_InitializesBoard()
    {
        var engine = new MinesweeperEngine();
        var state = engine.Create(null);
        Assert.Equal(5, state.Cells.Count);
    }

    [Fact]
    public void Reveal_UpdatesState()
    {
        var engine = new MinesweeperEngine();
        var state = engine.Create(null);
        state = engine.Reveal(state.GameId.Value, 0, 0);
        Assert.True(state.Revealed[0][0]);
    }
}
