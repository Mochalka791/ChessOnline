using Arcade.Core.Errors;
using Arcade.Core.Models;
using Arcade.Games.Chess.Rules;

namespace Arcade.Games.Chess.Domain;

public sealed class ChessMatch
{
    private readonly MoveValidator _validator;
    private readonly List<string> _moves = new();
    private readonly ChessBoard _board = new();
    private ChessResult? _result;

    public ChessMatch(GameId id, MoveValidator validator)
    {
        GameId = id;
        _validator = validator;
    }

    public GameId GameId { get; }

    public ChessState GetState()
    {
        var state = new ChessState
        {
            GameId = GameId,
            Fen = FEN.FromBoard(_board),
            Moves = _moves.AsReadOnly(),
            ActiveColor = _board.Turn,
            InCheck = IsInCheck(_board.Turn)
        };

        return state;
    }

    public ChessResult? GetResult() => _result;

    public ChessState ApplyMove(ChessMove move)
    {
        if (_result is not null)
        {
            throw new InvalidMoveException("Partie ist bereits beendet.");
        }

        if (!_validator.TryValidate(_board, move, out var error))
        {
            throw new InvalidMoveException(error ?? "Ungültiger Zug.");
        }

        var san = CreateSan(move);
        _board.Apply(move);
        _moves.Add(san);

        EvaluateOutcome();
        return GetState();
    }

    public ChessResult ForceOutcome(PieceColor? winner, string outcome, string reason)
    {
        _result = new ChessResult
        {
            GameId = GameId,
            Winner = winner,
            Outcome = outcome,
            Reason = reason
        };

        return _result;
    }

    private string CreateSan(ChessMove move)
    {
        var piece = _board.Cells[move.FromFile, move.FromRank];
        if (piece.Type == PieceType.King && Math.Abs(move.ToFile - move.FromFile) == 2)
        {
            return move.ToFile > move.FromFile ? "O-O" : "O-O-O";
        }

        var sb = new System.Text.StringBuilder();
        if (piece.Type != PieceType.Pawn)
        {
            sb.Append(PieceSymbol(piece.Type));
            if (RequiresDisambiguation(piece, move))
            {
                sb.Append((char)('a' + move.FromFile));
                sb.Append(8 - move.FromRank);
            }
        }
        else
        {
            if (IsCapture(move))
            {
                sb.Append((char)('a' + move.FromFile));
            }
        }

        if (IsCapture(move))
        {
            sb.Append('x');
        }

        sb.Append((char)('a' + move.ToFile));
        sb.Append(8 - move.ToRank);

        if (move.Promotion is PieceType promotion and not PieceType.None)
        {
            sb.Append('=').Append(PieceSymbol(promotion));
        }

        var clone = _board.Clone();
        clone.Apply(move);
        var opponent = clone.Turn;
        if (IsCheckmate(clone, opponent))
        {
            sb.Append('#');
        }
        else if (clone.IsSquareAttacked(clone.FindKing(opponent).File, clone.FindKing(opponent).Rank, OpponentOf(opponent)))
        {
            sb.Append('+');
        }

        return sb.ToString();
    }

    private bool IsCapture(ChessMove move)
    {
        var piece = _board.Cells[move.FromFile, move.FromRank];
        var target = _board.Cells[move.ToFile, move.ToRank];
        if (!target.IsEmpty && target.Color != piece.Color)
        {
            return true;
        }

        if (piece.Type == PieceType.Pawn && _board.EnPassant is { } ep && ep.File == move.ToFile && ep.Rank == move.ToRank)
        {
            return true;
        }

        return false;
    }

    private bool RequiresDisambiguation(Piece piece, ChessMove move)
    {
        for (var y = 0; y < 8; y++)
        {
            for (var x = 0; x < 8; x++)
            {
                if (x == move.FromFile && y == move.FromRank)
                {
                    continue;
                }

                var other = _board.Cells[x, y];
                if (other.Type != piece.Type || other.Color != piece.Color)
                {
                    continue;
                }

                var pseudo = _board.PseudoMovesFor(x, y, other);
                if (pseudo.Any(p => p.File == move.ToFile && p.Rank == move.ToRank))
                {
                    if (_validator.TryValidate(_board, new ChessMove(x, y, move.ToFile, move.ToRank, move.Promotion), out _))
                    {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    private void EvaluateOutcome()
    {
        var opponent = _board.Turn;
        var king = _board.FindKing(opponent);
        var inCheck = _board.IsSquareAttacked(king.File, king.Rank, OpponentOf(opponent));
        var hasMoves = EnumerateLegalMoves(opponent).Any();

        if (inCheck && !hasMoves)
        {
            _result = new ChessResult
            {
                GameId = GameId,
                Winner = OpponentOf(opponent),
                Outcome = OpponentOf(opponent) == PieceColor.White ? "1-0" : "0-1",
                Reason = "Schachmatt"
            };
        }
        else if (!inCheck && !hasMoves)
        {
            _result = new ChessResult
            {
                GameId = GameId,
                Winner = null,
                Outcome = "½-½",
                Reason = "Patt"
            };
        }
    }

    private IEnumerable<ChessMove> EnumerateLegalMoves(PieceColor color)
    {
        for (var rank = 0; rank < 8; rank++)
        {
            for (var file = 0; file < 8; file++)
            {
                var piece = _board.Cells[file, rank];
                if (piece.IsEmpty || piece.Color != color)
                {
                    continue;
                }

                foreach (var (targetFile, targetRank) in _board.PseudoMovesFor(file, rank, piece))
                {
                    var candidate = new ChessMove(file, rank, targetFile, targetRank);
                    if (_validator.TryValidate(_board, candidate, out _))
                    {
                        yield return candidate;
                    }
                }
            }
        }
    }

    private bool IsCheckmate(ChessBoard board, PieceColor color)
    {
        var king = board.FindKing(color);
        var inCheck = board.IsSquareAttacked(king.File, king.Rank, OpponentOf(color));
        if (!inCheck)
        {
            return false;
        }

        var validator = new MoveValidator();
        for (var rank = 0; rank < 8; rank++)
        {
            for (var file = 0; file < 8; file++)
            {
                var piece = board.Cells[file, rank];
                if (piece.IsEmpty || piece.Color != color)
                {
                    continue;
                }

                foreach (var (tf, tr) in board.PseudoMovesFor(file, rank, piece))
                {
                    var move = new ChessMove(file, rank, tf, tr);
                    if (validator.TryValidate(board, move, out _))
                    {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    private bool IsInCheck(PieceColor color)
    {
        var king = _board.FindKing(color);
        return _board.IsSquareAttacked(king.File, king.Rank, OpponentOf(color));
    }

    private static PieceColor OpponentOf(PieceColor color) =>
        color == PieceColor.White ? PieceColor.Black : PieceColor.White;

    private static char PieceSymbol(PieceType type) => type switch
    {
        PieceType.King => 'K',
        PieceType.Queen => 'Q',
        PieceType.Rook => 'R',
        PieceType.Bishop => 'B',
        PieceType.Knight => 'N',
        _ => '?' // sollte nie auftreten
    };
}
