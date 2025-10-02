namespace ChessOnline;

public sealed class SimpleBot
{
    private readonly Random _rng = new();

    private static readonly Dictionary<PieceType, int> Value = new()
    {
        [PieceType.Pawn] = 100,
        [PieceType.Knight] = 320,
        [PieceType.Bishop] = 330,
        [PieceType.Rook] = 500,
        [PieceType.Queen] = 900,
        [PieceType.King] = 20000
    };

    private int DepthFromElo(int elo) =>
        elo < 400 ? 1 :
        elo < 1000 ? 2 :
        elo < 1800 ? 3 :
        elo < 2600 ? 4 : 5;

    private double BlunderProbFromElo(int elo) =>
        Math.Clamp(1.0 - (elo / 3000.0), 0.02, 0.6);

    private int Score(Board b, PieceColor pov)
    {
        int s = 0;
        for (int y = 0; y < 8; y++)
            for (int x = 0; x < 8; x++)
            {
                var p = b.Cells[x, y];
                if (p.IsEmpty) continue;
                int v = Value[p.Type];
                s += (p.Color == pov) ? v : -v;
            }
        return s;
    }

    private int Minimax(Board b, int depth, int alpha, int beta, PieceColor pov)
    {
        if (depth == 0) return Score(b, pov);
        var side = b.Turn;
        var moves = b.AllLegalMoves(side).ToList();
        if (moves.Count == 0)
        {
            if (b.IsInCheck(side)) return side == pov ? int.MinValue / 4 : int.MaxValue / 4;
            return 0;
        }

        if (side == pov)
        {
            int best = int.MinValue;
            foreach (var m in moves)
            {
                var c = b.Clone();
                c.TryMove(m.fx, m.fy, m.tx, m.ty, null);
                best = Math.Max(best, Minimax(c, depth - 1, alpha, beta, pov));
                alpha = Math.Max(alpha, best);
                if (beta <= alpha) break;
            }
            return best;
        }
        else
        {
            int best = int.MaxValue;
            foreach (var m in moves)
            {
                var c = b.Clone();
                c.TryMove(m.fx, m.fy, m.tx, m.ty, null);
                best = Math.Min(best, Minimax(c, depth - 1, alpha, beta, pov));
                beta = Math.Min(beta, best);
                if (beta <= alpha) break;
            }
            return best;
        }
    }

    public bool TryMakeMove(Board board, PieceColor color, int elo,
                            out (int fx, int fy, int tx, int ty) move)
    {
        var legal = board.AllLegalMoves(color).ToList();
        if (legal.Count == 0) { move = (0, 0, 0, 0); return false; }

        int depth = DepthFromElo(elo);
        double blunderProb = BlunderProbFromElo(elo);

        var scored = new List<((int fx, int fy, int tx, int ty) m, int score)>();
        foreach (var m in legal)
        {
            var c = board.Clone();
            c.TryMove(m.fx, m.fy, m.tx, m.ty, null);
            int sc = Minimax(c, depth - 1, int.MinValue / 2, int.MaxValue / 2, color);
            scored.Add((m, sc));
        }

        scored = scored.OrderByDescending(s => s.score).ToList();
        var pick = scored.First().m;

        if (_rng.NextDouble() < blunderProb && scored.Count > 3)
        {
            int cutoff = Math.Max(3, scored.Count * 7 / 10);
            pick = scored[_rng.Next(cutoff, scored.Count)].m;
        }

        move = pick;
        return board.TryMove(pick.fx, pick.fy, pick.tx, pick.ty, null).Ok;
    }

    public int Evaluate(Board b, int depth, PieceColor pov) =>
        Minimax(b, depth, int.MinValue / 2, int.MaxValue / 2, pov);
}
