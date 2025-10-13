using Arcade.Core.Models;

namespace Arcade.Games.Minesweeper.Domain;

public sealed record MineField : GameState
{
    public IReadOnlyList<IReadOnlyList<int>> Cells { get; init; } = Array.Empty<IReadOnlyList<int>>();

    public IReadOnlyList<IReadOnlyList<bool>> Revealed { get; init; } = Array.Empty<IReadOnlyList<bool>>();

    public bool GameOver { get; init; }
        = false;

    public bool Won { get; init; }
        = false;
}
