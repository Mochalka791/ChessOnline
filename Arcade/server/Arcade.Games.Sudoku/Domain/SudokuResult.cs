using Arcade.Core.Models;

namespace Arcade.Games.Sudoku.Domain;

public sealed record SudokuResult : GameResult
{
    public int HintsUsed { get; init; }
        = 0;
}
