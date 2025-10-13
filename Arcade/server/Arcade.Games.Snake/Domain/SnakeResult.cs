using Arcade.Core.Models;

namespace Arcade.Games.Snake.Domain;

public sealed record SnakeResult : GameResult
{
    public int Score { get; init; }
        = 0;
}
