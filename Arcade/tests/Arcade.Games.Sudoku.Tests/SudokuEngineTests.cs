using Arcade.Games.Sudoku.Engine;
using Xunit;

namespace Arcade.Games.Sudoku.Tests;

public sealed class SudokuEngineTests
{
    [Fact]
    public void NewGame_Has_81Cells()
    {
        var engine = new SudokuEngine();
        var state = engine.Create(null);
        Assert.Equal(9, state.Cells.Count);
        Assert.All(state.Cells, row => Assert.Equal(9, row.Length));
    }

    [Fact]
    public void Solve_Returns_Win_WhenAllCellsSet()
    {
        var engine = new SudokuEngine();
        var state = engine.Create(null);
        for (var r = 0; r < 9; r++)
        {
            for (var c = 0; c < 9; c++)
            {
                if (state.Cells[r][c] == 0)
                {
                    state = engine.Validate(state.GameId.Value, r, c, 1);
                }
            }
        }

        Assert.NotNull(engine.ForceWin(state.GameId.Value));
    }
}
