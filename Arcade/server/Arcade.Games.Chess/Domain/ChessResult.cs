using Arcade.Core.Models;

namespace Arcade.Games.Chess.Domain;

public sealed record ChessResult : GameResult
{
    public string Reason { get; init; } = string.Empty;

    public PieceColor? Winner { get; init; }
        = null;
}
