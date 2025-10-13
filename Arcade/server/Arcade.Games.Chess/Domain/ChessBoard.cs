using System.Text;

namespace Arcade.Games.Chess.Domain;

public enum PieceType
{
    None,
    Pawn,
    Rook,
    Knight,
    Bishop,
    Queen,
    King
}

public enum PieceColor
{
    White,
    Black
}

public readonly record struct Piece(PieceType Type, PieceColor Color)
{
    public static readonly Piece Empty = new(PieceType.None, PieceColor.White);

    public bool IsEmpty => Type == PieceType.None;
}

public sealed class ChessBoard
{
    public Piece[,] Cells { get; } = new Piece[8, 8];

    public PieceColor Turn { get; set; } = PieceColor.White;

    public bool WhiteCastleKingSide { get; set; } = true;
    public bool WhiteCastleQueenSide { get; set; } = true;
    public bool BlackCastleKingSide { get; set; } = true;
    public bool BlackCastleQueenSide { get; set; } = true;

    public (int File, int Rank)? EnPassant { get; set; };

    public ChessBoard()
    {
        SetupStart();
    }

    public void SetupStart()
    {
        for (var y = 0; y < 8; y++)
        {
            for (var x = 0; x < 8; x++)
            {
                Cells[x, y] = Piece.Empty;
            }
        }

        Span<PieceType> backRank = stackalloc[]
        {
            PieceType.Rook,
            PieceType.Knight,
            PieceType.Bishop,
            PieceType.Queen,
            PieceType.King,
            PieceType.Bishop,
            PieceType.Knight,
            PieceType.Rook
        };

        for (var file = 0; file < 8; file++)
        {
            Cells[file, 7] = new Piece(backRank[file], PieceColor.White);
            Cells[file, 6] = new Piece(PieceType.Pawn, PieceColor.White);
            Cells[file, 0] = new Piece(backRank[file], PieceColor.Black);
            Cells[file, 1] = new Piece(PieceType.Pawn, PieceColor.Black);
        }

        Turn = PieceColor.White;
        WhiteCastleKingSide = WhiteCastleQueenSide = true;
        BlackCastleKingSide = BlackCastleQueenSide = true;
        EnPassant = null;
    }

    public ChessBoard Clone()
    {
        var clone = new ChessBoard
        {
            Turn = Turn,
            WhiteCastleKingSide = WhiteCastleKingSide,
            WhiteCastleQueenSide = WhiteCastleQueenSide,
            BlackCastleKingSide = BlackCastleKingSide,
            BlackCastleQueenSide = BlackCastleQueenSide,
            EnPassant = EnPassant
        };

        for (var y = 0; y < 8; y++)
        {
            for (var x = 0; x < 8; x++)
            {
                clone.Cells[x, y] = Cells[x, y];
            }
        }

        return clone;
    }

    public bool InBounds(int file, int rank) => file is >= 0 and < 8 && rank is >= 0 and < 8;

    public IEnumerable<(int File, int Rank)> PseudoMovesFor(int file, int rank, Piece piece)
    {
        var moves = new List<(int, int)>();

        switch (piece.Type)
        {
            case PieceType.Pawn:
            {
                var forward = piece.Color == PieceColor.White ? -1 : 1;
                var startRank = piece.Color == PieceColor.White ? 6 : 1;

                var nextRank = rank + forward;
                if (InBounds(file, nextRank) && Cells[file, nextRank].IsEmpty)
                {
                    moves.Add((file, nextRank));
                    if (rank == startRank)
                    {
                        var twoRank = nextRank + forward;
                        if (InBounds(file, twoRank) && Cells[file, twoRank].IsEmpty)
                        {
                            moves.Add((file, twoRank));
                        }
                    }
                }

                foreach (var captureFile in new[] { file - 1, file + 1 })
                {
                    if (!InBounds(captureFile, nextRank))
                    {
                        continue;
                    }

                    var occupant = Cells[captureFile, nextRank];
                    if (!occupant.IsEmpty && occupant.Color != piece.Color)
                    {
                        moves.Add((captureFile, nextRank));
                    }

                    if (EnPassant is { } ep && ep.File == captureFile && ep.Rank == nextRank)
                    {
                        moves.Add((captureFile, nextRank));
                    }
                }
                break;
            }
            case PieceType.Knight:
            {
                ReadOnlySpan<(int Dx, int Dy)> offsets = stackalloc (int, int)[]
                {
                    (-2, -1), (-2, 1), (-1, -2), (-1, 2),
                    (1, -2), (1, 2), (2, -1), (2, 1)
                };

                foreach (var (dx, dy) in offsets)
                {
                    var targetFile = file + dx;
                    var targetRank = rank + dy;
                    if (!InBounds(targetFile, targetRank))
                    {
                        continue;
                    }

                    var occupant = Cells[targetFile, targetRank];
                    if (occupant.IsEmpty || occupant.Color != piece.Color)
                    {
                        moves.Add((targetFile, targetRank));
                    }
                }
                break;
            }
            case PieceType.Bishop or PieceType.Rook or PieceType.Queen:
            {
                var directions = new List<(int Dx, int Dy)>();
                if (piece.Type is PieceType.Bishop or PieceType.Queen)
                {
                    directions.AddRange(new[] { (1, 1), (1, -1), (-1, 1), (-1, -1) });
                }

                if (piece.Type is PieceType.Rook or PieceType.Queen)
                {
                    directions.AddRange(new[] { (1, 0), (-1, 0), (0, 1), (0, -1) });
                }

                foreach (var (dx, dy) in directions)
                {
                    var targetFile = file + dx;
                    var targetRank = rank + dy;
                    while (InBounds(targetFile, targetRank))
                    {
                        var occupant = Cells[targetFile, targetRank];
                        if (occupant.IsEmpty)
                        {
                            moves.Add((targetFile, targetRank));
                        }
                        else
                        {
                            if (occupant.Color != piece.Color)
                            {
                                moves.Add((targetFile, targetRank));
                            }
                            break;
                        }

                        targetFile += dx;
                        targetRank += dy;
                    }
                }

                break;
            }
            case PieceType.King:
            {
                for (var dx = -1; dx <= 1; dx++)
                {
                    for (var dy = -1; dy <= 1; dy++)
                    {
                        if (dx == 0 && dy == 0)
                        {
                            continue;
                        }

                        var targetFile = file + dx;
                        var targetRank = rank + dy;

                        if (!InBounds(targetFile, targetRank))
                        {
                            continue;
                        }

                        var occupant = Cells[targetFile, targetRank];
                        if (occupant.IsEmpty || occupant.Color != piece.Color)
                        {
                            moves.Add((targetFile, targetRank));
                        }
                    }
                }

                if (piece.Color == PieceColor.White)
                {
                    if (WhiteCastleKingSide && Cells[5, 7].IsEmpty && Cells[6, 7].IsEmpty)
                    {
                        moves.Add((6, 7));
                    }

                    if (WhiteCastleQueenSide && Cells[3, 7].IsEmpty && Cells[2, 7].IsEmpty && Cells[1, 7].IsEmpty)
                    {
                        moves.Add((2, 7));
                    }
                }
                else
                {
                    if (BlackCastleKingSide && Cells[5, 0].IsEmpty && Cells[6, 0].IsEmpty)
                    {
                        moves.Add((6, 0));
                    }

                    if (BlackCastleQueenSide && Cells[3, 0].IsEmpty && Cells[2, 0].IsEmpty && Cells[1, 0].IsEmpty)
                    {
                        moves.Add((2, 0));
                    }
                }

                break;
            }
        }

        return moves;
    }

    public bool IsSquareAttacked(int file, int rank, PieceColor by)
    {
        var pawnDirection = by == PieceColor.White ? 1 : -1;
        foreach (var captureFile in new[] { file - 1, file + 1 })
        {
            var pawnRank = rank + pawnDirection;
            if (InBounds(captureFile, pawnRank))
            {
                var pawn = Cells[captureFile, pawnRank];
                if (pawn.Type == PieceType.Pawn && pawn.Color == by)
                {
                    return true;
                }
            }
        }

        ReadOnlySpan<(int Dx, int Dy)> knightOffsets = stackalloc (int, int)[]
        {
            (-2, -1), (-2, 1), (-1, -2), (-1, 2),
            (1, -2), (1, 2), (2, -1), (2, 1)
        };

        foreach (var (dx, dy) in knightOffsets)
        {
            var nx = file + dx;
            var ny = rank + dy;
            if (InBounds(nx, ny))
            {
                var piece = Cells[nx, ny];
                if (piece.Type == PieceType.Knight && piece.Color == by)
                {
                    return true;
                }
            }
        }

        ReadOnlySpan<(int Dx, int Dy)> bishopDirs = stackalloc (int, int)[]
        {
            (1, 1), (1, -1), (-1, 1), (-1, -1)
        };

        if (TraceRay(by, file, rank, bishopDirs, PieceType.Bishop, PieceType.Queen))
        {
            return true;
        }

        ReadOnlySpan<(int Dx, int Dy)> rookDirs = stackalloc (int, int)[]
        {
            (1, 0), (-1, 0), (0, 1), (0, -1)
        };

        if (TraceRay(by, file, rank, rookDirs, PieceType.Rook, PieceType.Queen))
        {
            return true;
        }

        for (var dx = -1; dx <= 1; dx++)
        {
            for (var dy = -1; dy <= 1; dy++)
            {
                if (dx == 0 && dy == 0)
                {
                    continue;
                }

                var nx = file + dx;
                var ny = rank + dy;
                if (!InBounds(nx, ny))
                {
                    continue;
                }

                var piece = Cells[nx, ny];
                if (piece.Type == PieceType.King && piece.Color == by)
                {
                    return true;
                }
            }
        }

        return false;
    }

    private bool TraceRay(PieceColor attacker, int file, int rank, ReadOnlySpan<(int Dx, int Dy)> directions, PieceType target, PieceType alt)
    {
        foreach (var (dx, dy) in directions)
        {
            var nx = file + dx;
            var ny = rank + dy;
            while (InBounds(nx, ny))
            {
                var piece = Cells[nx, ny];
                if (piece.IsEmpty)
                {
                    nx += dx;
                    ny += dy;
                    continue;
                }

                if (piece.Color == attacker && (piece.Type == target || piece.Type == alt))
                {
                    return true;
                }

                break;
            }
        }

        return false;
    }

    public (int File, int Rank) FindKing(PieceColor color)
    {
        for (var y = 0; y < 8; y++)
        {
            for (var x = 0; x < 8; x++)
            {
                var piece = Cells[x, y];
                if (piece.Type == PieceType.King && piece.Color == color)
                {
                    return (x, y);
                }
            }
        }

        throw new InvalidOperationException("King not found");
    }

    public void Apply(ChessMove move)
    {
        var piece = Cells[move.FromFile, move.FromRank];
        Cells[move.FromFile, move.FromRank] = Piece.Empty;

        if (piece.Type == PieceType.Pawn && move.Promotion is PieceType promotion && promotion != PieceType.None)
        {
            piece = new Piece(promotion, piece.Color);
        }

        if (piece.Type == PieceType.King)
        {
            if (piece.Color == PieceColor.White)
            {
                WhiteCastleKingSide = WhiteCastleQueenSide = false;
                if (move.ToFile == 6 && move.ToRank == 7)
                {
                    Cells[5, 7] = Cells[7, 7];
                    Cells[7, 7] = Piece.Empty;
                }
                else if (move.ToFile == 2 && move.ToRank == 7)
                {
                    Cells[3, 7] = Cells[0, 7];
                    Cells[0, 7] = Piece.Empty;
                }
            }
            else
            {
                BlackCastleKingSide = BlackCastleQueenSide = false;
                if (move.ToFile == 6 && move.ToRank == 0)
                {
                    Cells[5, 0] = Cells[7, 0];
                    Cells[7, 0] = Piece.Empty;
                }
                else if (move.ToFile == 2 && move.ToRank == 0)
                {
                    Cells[3, 0] = Cells[0, 0];
                    Cells[0, 0] = Piece.Empty;
                }
            }
        }

        if (piece.Type == PieceType.Rook)
        {
            if (move.FromFile == 0 && move.FromRank == 7)
            {
                WhiteCastleQueenSide = false;
            }
            else if (move.FromFile == 7 && move.FromRank == 7)
            {
                WhiteCastleKingSide = false;
            }
            else if (move.FromFile == 0 && move.FromRank == 0)
            {
                BlackCastleQueenSide = false;
            }
            else if (move.FromFile == 7 && move.FromRank == 0)
            {
                BlackCastleKingSide = false;
            }
        }

        if (piece.Type == PieceType.Pawn && EnPassant is { } ep && move.ToFile == ep.File && move.ToRank == ep.Rank)
        {
            var captureRank = piece.Color == PieceColor.White ? move.ToRank + 1 : move.ToRank - 1;
            Cells[move.ToFile, captureRank] = Piece.Empty;
        }

        Cells[move.ToFile, move.ToRank] = piece;

        EnPassant = null;
        if (piece.Type == PieceType.Pawn && Math.Abs(move.FromRank - move.ToRank) == 2)
        {
            var midRank = (move.FromRank + move.ToRank) / 2;
            EnPassant = (move.FromFile, midRank);
        }

        Turn = Turn == PieceColor.White ? PieceColor.Black : PieceColor.White;
    }
}
