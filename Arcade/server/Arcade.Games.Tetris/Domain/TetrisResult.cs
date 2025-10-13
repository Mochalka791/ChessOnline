using Arcade.Core.Models;

namespace Arcade.Games.Tetris.Domain;

public sealed record TetrisResult : GameResult
{
    public int Score { get; init; }
        = 0;
}
