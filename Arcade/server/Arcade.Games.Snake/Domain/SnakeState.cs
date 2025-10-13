using Arcade.Core.Models;

namespace Arcade.Games.Snake.Domain;

public sealed record SnakeState : GameState
{
    public IReadOnlyList<(int X, int Y)> Body { get; init; } = Array.Empty<(int, int)>();

    public (int X, int Y) Food { get; init; }
        = (0, 0);

    public int Score { get; init; }
        = 0;

    public bool Alive { get; init; }
        = true;

    public int Width { get; init; } = 16;

    public int Height { get; init; } = 16;
}
