using System.Text;

namespace Arcade.Games.Chess.Domain;

public static class FEN
{
    public static string FromBoard(ChessBoard board)
    {
        var fen = new StringBuilder();
        for (var rank = 0; rank < 8; rank++)
        {
            var empty = 0;
            for (var file = 0; file < 8; file++)
            {
                var piece = board.Cells[file, rank];
                if (piece.IsEmpty)
                {
                    empty++;
                    continue;
                }

                if (empty > 0)
                {
                    fen.Append(empty);
                    empty = 0;
                }

                fen.Append(PieceToChar(piece));
            }

            if (empty > 0)
            {
                fen.Append(empty);
            }

            if (rank != 7)
            {
                fen.Append('/');
            }
        }

        fen.Append(' ');
        fen.Append(board.Turn == PieceColor.White ? 'w' : 'b');
        fen.Append(' ');

        var castling = new StringBuilder();
        if (board.WhiteCastleKingSide)
        {
            castling.Append('K');
        }
        if (board.WhiteCastleQueenSide)
        {
            castling.Append('Q');
        }
        if (board.BlackCastleKingSide)
        {
            castling.Append('k');
        }
        if (board.BlackCastleQueenSide)
        {
            castling.Append('q');
        }

        fen.Append(castling.Length == 0 ? "-" : castling.ToString());
        fen.Append(' ');

        if (board.EnPassant is { } ep)
        {
            fen.Append((char)('a' + ep.File));
            fen.Append(8 - ep.Rank);
        }
        else
        {
            fen.Append('-');
        }

        fen.Append(" 0 1");
        return fen.ToString();
    }

    private static char PieceToChar(Piece piece)
    {
        var symbol = piece.Type switch
        {
            PieceType.Pawn => 'p',
            PieceType.Rook => 'r',
            PieceType.Knight => 'n',
            PieceType.Bishop => 'b',
            PieceType.Queen => 'q',
            PieceType.King => 'k',
            _ => ' '
        };

        return piece.Color == PieceColor.White ? char.ToUpperInvariant(symbol) : symbol;
    }
}
