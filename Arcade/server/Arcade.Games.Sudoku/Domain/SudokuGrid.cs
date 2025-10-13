using Arcade.Core.Models;

namespace Arcade.Games.Sudoku.Domain;

public sealed record SudokuGrid : GameState
{
    public IReadOnlyList<int[]> Cells { get; init; } = Array.Empty<int[]>();

    public bool Solved { get; init; }
        = false;

    public int HintsUsed { get; init; }
        = 0;
}
