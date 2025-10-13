using Arcade.Core.Models;

namespace Arcade.Games.Blockwood.Domain;

public sealed record BlockwoodState : GameState
{
    public int Moves { get; init; }
        = 0;

    public int TargetMoves { get; init; }
        = 40;

    public bool Solved { get; init; }
        = false;
}
