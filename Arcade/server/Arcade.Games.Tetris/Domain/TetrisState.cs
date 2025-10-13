using Arcade.Core.Models;

namespace Arcade.Games.Tetris.Domain;

public sealed record TetrisState : GameState
{
    public int Level { get; init; }
        = 1;

    public int Score { get; init; }
        = 0;

    public int LinesCleared { get; init; }
        = 0;

    public IReadOnlyList<string> Well { get; init; } = Array.Empty<string>();

    public string ActivePiece { get; init; } = "I";
}
