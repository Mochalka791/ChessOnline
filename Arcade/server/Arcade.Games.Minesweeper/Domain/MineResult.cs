using Arcade.Core.Models;

namespace Arcade.Games.Minesweeper.Domain;

public sealed record MineResult : GameResult
{
    public bool Won { get; init; }
        = false;
}
