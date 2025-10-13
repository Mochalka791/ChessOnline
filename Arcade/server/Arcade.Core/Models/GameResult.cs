namespace Arcade.Core.Models;

public abstract record GameResult
{
    public GameId GameId { get; init; }

    public string Outcome { get; init; } = string.Empty;
}
