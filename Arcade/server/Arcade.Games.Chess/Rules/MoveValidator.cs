using Arcade.Core.Errors;
using Arcade.Games.Chess.Domain;

namespace Arcade.Games.Chess.Rules;

public sealed class MoveValidator
{
    public bool TryValidate(ChessBoard board, ChessMove move, out string? error)
    {
        error = null;
        if (!board.InBounds(move.FromFile, move.FromRank) || !board.InBounds(move.ToFile, move.ToRank))
        {
            error = "Zug außerhalb des Bretts.";
            return false;
        }

        var piece = board.Cells[move.FromFile, move.FromRank];
        if (piece.IsEmpty)
        {
            error = "Keine Figur auf dem Startfeld.";
            return false;
        }

        if (piece.Color != board.Turn)
        {
            error = "Du bist nicht am Zug.";
            return false;
        }

        var target = board.Cells[move.ToFile, move.ToRank];
        if (!target.IsEmpty && target.Color == piece.Color)
        {
            error = "Eigenes Feld blockiert.";
            return false;
        }

        var pseudoMoves = board.PseudoMovesFor(move.FromFile, move.FromRank, piece);
        if (!pseudoMoves.Any(p => p.File == move.ToFile && p.Rank == move.ToRank))
        {
            error = "Zug ist nicht erlaubt.";
            return false;
        }

        if (piece.Type == PieceType.King && Math.Abs(move.ToFile - move.FromFile) == 2)
        {
            if (board.IsSquareAttacked(move.FromFile, move.FromRank, OpponentOf(piece.Color)))
            {
                error = "Rochade nicht möglich: König steht im Schach.";
                return false;
            }

            var step = move.ToFile > move.FromFile ? 1 : -1;
            var currentFile = move.FromFile + step;
            while (currentFile != move.ToFile)
            {
                if (board.IsSquareAttacked(currentFile, move.FromRank, OpponentOf(piece.Color)))
                {
                    error = "Rochade nicht möglich: Weg ist angegriffen.";
                    return false;
                }

                currentFile += step;
            }
        }

        var clone = board.Clone();
        clone.Apply(move);
        var king = clone.FindKing(piece.Color);
        if (clone.IsSquareAttacked(king.File, king.Rank, OpponentOf(piece.Color)))
        {
            error = "Der König wäre im Schach.";
            return false;
        }

        return true;
    }

    private static PieceColor OpponentOf(PieceColor color) =>
        color == PieceColor.White ? PieceColor.Black : PieceColor.White;
}
