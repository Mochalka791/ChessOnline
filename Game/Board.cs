namespace ChessOnline;

public sealed class Board
{
    public Piece[,] Cells { get; } = new Piece[8, 8];
    public PieceColor Turn { get; set; } = PieceColor.White;

    public bool WhiteCastleK { get; set; } = true;
    public bool WhiteCastleQ { get; set; } = true;
    public bool BlackCastleK { get; set; } = true;
    public bool BlackCastleQ { get; set; } = true;

    public (int x, int y)? EnPassant { get; set; } = null;

    public Board() => SetupStart();

    public void SetupStart()
    {
        for (int y = 0; y < 8; y++)
            for (int x = 0; x < 8; x++)
                Cells[x, y] = Piece.Empty;

        Cells[0, 7] = new(PieceType.Rook, PieceColor.White);
        Cells[1, 7] = new(PieceType.Knight, PieceColor.White);
        Cells[2, 7] = new(PieceType.Bishop, PieceColor.White);
        Cells[3, 7] = new(PieceType.Queen, PieceColor.White);
        Cells[4, 7] = new(PieceType.King, PieceColor.White);
        Cells[5, 7] = new(PieceType.Bishop, PieceColor.White);
        Cells[6, 7] = new(PieceType.Knight, PieceColor.White);
        Cells[7, 7] = new(PieceType.Rook, PieceColor.White);
        for (int x = 0; x < 8; x++) Cells[x, 6] = new(PieceType.Pawn, PieceColor.White);

        Cells[0, 0] = new(PieceType.Rook, PieceColor.Black);
        Cells[1, 0] = new(PieceType.Knight, PieceColor.Black);
        Cells[2, 0] = new(PieceType.Bishop, PieceColor.Black);
        Cells[3, 0] = new(PieceType.Queen, PieceColor.Black);
        Cells[4, 0] = new(PieceType.King, PieceColor.Black);
        Cells[5, 0] = new(PieceType.Bishop, PieceColor.Black);
        Cells[6, 0] = new(PieceType.Knight, PieceColor.Black);
        Cells[7, 0] = new(PieceType.Rook, PieceColor.Black);
        for (int x = 0; x < 8; x++) Cells[x, 1] = new(PieceType.Pawn, PieceColor.Black);

        Turn = PieceColor.White;
        WhiteCastleK = WhiteCastleQ = BlackCastleK = BlackCastleQ = true;
        EnPassant = null;
    }

    public Board Clone()
    {
        var b = new Board
        {
            Turn = Turn,
            WhiteCastleK = WhiteCastleK,
            WhiteCastleQ = WhiteCastleQ,
            BlackCastleK = BlackCastleK,
            BlackCastleQ = BlackCastleQ,
            EnPassant = EnPassant
        };
        for (int y = 0; y < 8; y++)
            for (int x = 0; x < 8; x++)
                b.Cells[x, y] = Cells[x, y];
        return b;
    }

    public bool InBounds(int x, int y) => x >= 0 && x < 8 && y >= 0 && y < 8;

    public IEnumerable<(int tx, int ty)> PseudoMovesFor(int x, int y, Piece p)
    {
        var res = new List<(int, int)>();

        if (p.Type == PieceType.Pawn)
        {
            int dir = p.Color == PieceColor.White ? -1 : 1;
            int start = p.Color == PieceColor.White ? 6 : 1;

            int ny = y + dir;
            if (InBounds(x, ny) && Cells[x, ny].IsEmpty) res.Add((x, ny));
            if (y == start && InBounds(x, ny) && Cells[x, ny].IsEmpty && InBounds(x, ny + dir) && Cells[x, ny + dir].IsEmpty)
                res.Add((x, ny + dir));

            foreach (var dx in new[] { -1, 1 })
            {
                int nx = x + dx; ny = y + dir;
                if (!InBounds(nx, ny)) continue;

                if (!Cells[nx, ny].IsEmpty && Cells[nx, ny].Color != p.Color)
                    res.Add((nx, ny));

                if (EnPassant is { } ep && ep.x == nx && ep.y == ny)
                    res.Add((nx, ny));
            }
        }
        else if (p.Type == PieceType.Knight)
        {
            int[] dx = { -2, -2, -1, -1, 1, 1, 2, 2 };
            int[] dy = { -1, 1, -2, 2, -2, 2, -1, 1 };
            for (int i = 0; i < 8; i++)
            {
                int nx = x + dx[i], ny = y + dy[i];
                if (!InBounds(nx, ny)) continue;
                if (Cells[nx, ny].IsEmpty || Cells[nx, ny].Color != p.Color) res.Add((nx, ny));
            }
        }
        else if (p.Type == PieceType.Bishop || p.Type == PieceType.Rook || p.Type == PieceType.Queen)
        {
            var dirs = new List<(int, int)>();
            if (p.Type is PieceType.Bishop or PieceType.Queen)
                dirs.AddRange(new[] { (1, 1), (1, -1), (-1, 1), (-1, -1) });
            if (p.Type is PieceType.Rook or PieceType.Queen)
                dirs.AddRange(new[] { (1, 0), (-1, 0), (0, 1), (0, -1) });

            foreach (var (dx, dy) in dirs)
            {
                int nx = x + dx, ny = y + dy;
                while (InBounds(nx, ny))
                {
                    if (Cells[nx, ny].IsEmpty) { res.Add((nx, ny)); nx += dx; ny += dy; }
                    else { if (Cells[nx, ny].Color != p.Color) res.Add((nx, ny)); break; }
                }
            }
        }
        else if (p.Type == PieceType.King)
        {
            for (int dx = -1; dx <= 1; dx++)
                for (int dy = -1; dy <= 1; dy++)
                {
                    if (dx == 0 && dy == 0) continue;
                    int nx = x + dx, ny = y + dy;
                    if (!InBounds(nx, ny)) continue;
                    if (Cells[nx, ny].IsEmpty || Cells[nx, ny].Color != p.Color) res.Add((nx, ny));
                }
            if (p.Color == PieceColor.White)
            {
                if (WhiteCastleK && Cells[5, 7].IsEmpty && Cells[6, 7].IsEmpty) res.Add((6, 7));
                if (WhiteCastleQ && Cells[3, 7].IsEmpty && Cells[2, 7].IsEmpty && Cells[1, 7].IsEmpty) res.Add((2, 7));
            }
            else
            {
                if (BlackCastleK && Cells[5, 0].IsEmpty && Cells[6, 0].IsEmpty) res.Add((6, 0));
                if (BlackCastleQ && Cells[3, 0].IsEmpty && Cells[2, 0].IsEmpty && Cells[1, 0].IsEmpty) res.Add((2, 0));
            }
        }
        return res;
    }

    public bool IsSquareAttacked(int x, int y, PieceColor by)
    {
        // пешки: атакующая пешка стоит на y+pdir
        int pdir = by == PieceColor.White ? +1 : -1;
        foreach (var dx in new[] { -1, 1 })
        {
            int nx = x + dx, ny = y + pdir;
            if (InBounds(nx, ny) && Cells[nx, ny].Type == PieceType.Pawn && Cells[nx, ny].Color == by)
                return true;
        }
        // кони
        int[] kdx = { -2, -2, -1, -1, 1, 1, 2, 2 };
        int[] kdy = { -1, 1, -2, 2, -2, 2, -1, 1 };
        for (int i = 0; i < 8; i++)
        {
            int nx = x + kdx[i], ny = y + kdy[i];
            if (InBounds(nx, ny) && Cells[nx, ny].Type == PieceType.Knight && Cells[nx, ny].Color == by)
                return true;
        }
        // король
        for (int dx = -1; dx <= 1; dx++)
            for (int dy = -1; dy <= 1; dy++)
            {
                if (dx == 0 && dy == 0) continue;
                int nx = x + dx, ny = y + dy;
                if (InBounds(nx, ny) && Cells[nx, ny].Type == PieceType.King && Cells[nx, ny].Color == by)
                    return true;
            }
        // лучевые
        bool Ray(int dx, int dy, params PieceType[] types)
        {
            int nx = x + dx, ny = y + dy;
            while (InBounds(nx, ny))
            {
                var q = Cells[nx, ny];
                if (q.IsEmpty) { nx += dx; ny += dy; continue; }
                if (q.Color == by && types.Contains(q.Type)) return true;
                break;
            }
            return false;
        }
        if (Ray(1, 0, PieceType.Rook, PieceType.Queen)) return true;
        if (Ray(-1, 0, PieceType.Rook, PieceType.Queen)) return true;
        if (Ray(0, 1, PieceType.Rook, PieceType.Queen)) return true;
        if (Ray(0, -1, PieceType.Rook, PieceType.Queen)) return true;
        if (Ray(1, 1, PieceType.Bishop, PieceType.Queen)) return true;
        if (Ray(1, -1, PieceType.Bishop, PieceType.Queen)) return true;
        if (Ray(-1, 1, PieceType.Bishop, PieceType.Queen)) return true;
        if (Ray(-1, -1, PieceType.Bishop, PieceType.Queen)) return true;

        return false;
    }

    public (int x, int y) FindKing(PieceColor color)
    {
        for (int y = 0; y < 8; y++)
            for (int x = 0; x < 8; x++)
                if (Cells[x, y].Type == PieceType.King && Cells[x, y].Color == color)
                    return (x, y);
        return (-1, -1);
    }

    public bool IsInCheck(PieceColor color)
    {
        var (kx, ky) = FindKing(color);
        if (kx < 0) return true;
        var opp = color == PieceColor.White ? PieceColor.Black : PieceColor.White;
        return IsSquareAttacked(kx, ky, opp);
    }

    public IEnumerable<(int fx, int fy, int tx, int ty)> AllLegalMoves(PieceColor color)
    {
        for (int y = 0; y < 8; y++)
            for (int x = 0; x < 8; x++)
            {
                var p = Cells[x, y];
                if (p.IsEmpty || p.Color != color) continue;
                foreach (var (tx, ty) in PseudoMovesFor(x, y, p))
                    if (TryMove(x, y, tx, ty, null, simulate: true).Ok)
                        yield return (x, y, tx, ty);
            }
    }

    public bool HasAnyLegalMoves(PieceColor color) => AllLegalMoves(color).Any();

    public MoveResult TryMove(int fx, int fy, int tx, int ty, string? promoteTo, bool simulate = false)
    {
        if (!InBounds(fx, fy) || !InBounds(tx, ty)) return new MoveResult { Ok = false, Error = "Out of board" };
        var piece = Cells[fx, fy];
        if (piece.IsEmpty) return new MoveResult { Ok = false, Error = "No piece" };
        if (piece.Color != Turn) return new MoveResult { Ok = false, Error = "Not your turn" };

        var target = Cells[tx, ty];
        bool isCastle = piece.Type == PieceType.King && Math.Abs(tx - fx) == 2;

        if (!PseudoMovesFor(fx, fy, piece).Any(m => m.tx == tx && m.ty == ty))
            return new MoveResult { Ok = false, Error = "Illegal move" };
        if (target.Type == PieceType.King)
            return new MoveResult { Ok = false, Error = "King cannot be captured" };

        var snap = Snapshot();

        // en passant
        if (piece.Type == PieceType.Pawn && tx != fx && target.IsEmpty && EnPassant is { } ep && ep.x == tx && ep.y == ty)
        {
            int dy = (piece.Color == PieceColor.White) ? 1 : -1;
            Cells[tx, ty + dy] = Piece.Empty;
        }

        // рокировка
        if (isCastle)
        {
            if (piece.Color == PieceColor.White)
            {
                if (fx == 4 && fy == 7 && tx == 6)
                {
                    if (!WhiteCastleK || IsInCheck(PieceColor.White) || IsSquareAttacked(5, 7, PieceColor.Black) || IsSquareAttacked(6, 7, PieceColor.Black))
                    { Restore(snap); return new MoveResult { Ok = false, Error = "Castling not allowed" }; }
                    Cells[5, 7] = Cells[7, 7]; Cells[7, 7] = Piece.Empty;
                }
                else if (fx == 4 && fy == 7 && tx == 2)
                {
                    if (!WhiteCastleQ || IsInCheck(PieceColor.White) || IsSquareAttacked(3, 7, PieceColor.Black) || IsSquareAttacked(2, 7, PieceColor.Black))
                    { Restore(snap); return new MoveResult { Ok = false, Error = "Castling not allowed" }; }
                    Cells[3, 7] = Cells[0, 7]; Cells[0, 7] = Piece.Empty;
                }
            }
            else
            {
                if (fx == 4 && fy == 0 && tx == 6)
                {
                    if (!BlackCastleK || IsInCheck(PieceColor.Black) || IsSquareAttacked(5, 0, PieceColor.White) || IsSquareAttacked(6, 0, PieceColor.White))
                    { Restore(snap); return new MoveResult { Ok = false, Error = "Castling not allowed" }; }
                    Cells[5, 0] = Cells[7, 0]; Cells[7, 0] = Piece.Empty;
                }
                else if (fx == 4 && fy == 0 && tx == 2)
                {
                    if (!BlackCastleQ || IsInCheck(PieceColor.Black) || IsSquareAttacked(3, 0, PieceColor.White) || IsSquareAttacked(2, 0, PieceColor.White))
                    { Restore(snap); return new MoveResult { Ok = false, Error = "Castling not allowed" }; }
                    Cells[3, 0] = Cells[0, 0]; Cells[0, 0] = Piece.Empty;
                }
            }
        }

        // перенос фигуры
        Cells[tx, ty] = piece;
        Cells[fx, fy] = Piece.Empty;

        // промоция
        if (piece.Type == PieceType.Pawn && (ty == 0 || ty == 7))
        {
            var t = promoteTo?.ToLowerInvariant() ?? "queen";
            var newType = t switch
            {
                "rook" => PieceType.Rook,
                "bishop" => PieceType.Bishop,
                "knight" => PieceType.Knight,
                _ => PieceType.Queen
            };
            Cells[tx, ty] = new(newType, piece.Color);
        }

        // права рокировки
        if (piece.Type == PieceType.King)
        {
            if (piece.Color == PieceColor.White) { WhiteCastleK = false; WhiteCastleQ = false; }
            else { BlackCastleK = false; BlackCastleQ = false; }
        }
        if (piece.Type == PieceType.Rook)
        {
            if (piece.Color == PieceColor.White)
            { if (fx == 7 && fy == 7) WhiteCastleK = false; if (fx == 0 && fy == 7) WhiteCastleQ = false; }
            else
            { if (fx == 7 && fy == 0) BlackCastleK = false; if (fx == 0 && fy == 0) BlackCastleQ = false; }
        }
        if (tx == 7 && ty == 7) WhiteCastleK = false;
        if (tx == 0 && ty == 7) WhiteCastleQ = false;
        if (tx == 7 && ty == 0) BlackCastleK = false;
        if (tx == 0 && ty == 0) BlackCastleQ = false;

        // новая en-passant
        if (piece.Type == PieceType.Pawn && Math.Abs(ty - fy) == 2)
        {
            int midY = (ty + fy) / 2;
            EnPassant = (tx, midY);
        }
        else EnPassant = null;

        // легальность
        if (IsInCheck(piece.Color))
        {
            Restore(snap);
            return new MoveResult { Ok = false, Error = "Move leaves king in check" };
        }

        if (simulate)
        {
            Restore(snap);
            return new MoveResult { Ok = true };
        }

        Turn = Turn == PieceColor.White ? PieceColor.Black : PieceColor.White;
        return new MoveResult { Ok = true };
    }

    private (Piece[,] cells, PieceColor turn, bool wcK, bool wcQ, bool bcK, bool bcQ, (int, int)? ep) Snapshot()
    {
        var copy = new Piece[8, 8];
        for (int y = 0; y < 8; y++)
            for (int x = 0; x < 8; x++)
                copy[x, y] = Cells[x, y];
        return (copy, Turn, WhiteCastleK, WhiteCastleQ, BlackCastleK, BlackCastleQ, EnPassant);
    }
    private void Restore((Piece[,] cells, PieceColor turn, bool wcK, bool wcQ, bool bcK, bool bcQ, (int, int)? ep) s)
    {
        for (int y = 0; y < 8; y++)
            for (int x = 0; x < 8; x++)
                Cells[x, y] = s.cells[x, y];
        Turn = s.turn;
        WhiteCastleK = s.wcK; WhiteCastleQ = s.wcQ; BlackCastleK = s.bcK; BlackCastleQ = s.bcQ;
        EnPassant = s.ep;
    }
}
