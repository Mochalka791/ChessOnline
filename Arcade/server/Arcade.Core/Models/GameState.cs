namespace Arcade.Core.Models;

public abstract record GameState
{
    public GameId GameId { get; init; }

    public DateTimeOffset UpdatedAt { get; init; } = DateTimeOffset.UtcNow;
}
