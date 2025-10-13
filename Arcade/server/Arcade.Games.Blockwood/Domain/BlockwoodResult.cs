using Arcade.Core.Models;

namespace Arcade.Games.Blockwood.Domain;

public sealed record BlockwoodResult : GameResult
{
    public int Moves { get; init; }
        = 0;
}
