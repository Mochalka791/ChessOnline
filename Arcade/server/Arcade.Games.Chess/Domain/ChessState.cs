using Arcade.Core.Models;

namespace Arcade.Games.Chess.Domain;

public sealed record ChessState : GameState
{
    public string Fen { get; init; } = string.Empty;

    public IReadOnlyList<string> Moves { get; init; } = Array.Empty<string>();

    public PieceColor ActiveColor { get; init; }
        = PieceColor.White;

    public bool InCheck { get; init; }
        = false;
}
