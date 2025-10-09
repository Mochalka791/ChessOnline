using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace ChessOnline;

public readonly record struct LastMoveAnalysisContext(
    MoveRec LastMove,
    PieceColor Mover,
    string UciBefore,
    string UciAfter,
    string LastMoveUci,
    Board PositionBefore);

public sealed class ChessGame
{
    public string RoomId { get; }
    private readonly Board _board = new();
    private readonly SimpleBot _bot = new();

    private string? _whiteConn;
    private string? _blackConn;
    private string _whiteName = "White";
    private string _blackName = "Black";

    private PieceColor? _botColor;
    private int _botElo = 1000;

    private readonly List<MoveRec> _history = new();
    private (int fx, int fy, int tx, int ty)? _lastMove;

    // Таймеры (5+2)
    private const int InitialMs = 5 * 60 * 1000;
    private const int IncMs = 2 * 1000;
    private int WhiteMs = InitialMs;
    private int BlackMs = InitialMs;
    private DateTime? TurnStartUtc = null;

    public ChessGame(string roomId) => RoomId = roomId;

    private void StartClockIfNeeded()
    {
        if (TurnStartUtc is null) TurnStartUtc = DateTime.UtcNow;
    }
    private void ApplyClockOnMove(PieceColor mover)
    {
        if (TurnStartUtc is DateTime t0)
        {
            int spent = (int)(DateTime.UtcNow - t0).TotalMilliseconds;
            if (mover == PieceColor.White) WhiteMs = Math.Max(0, WhiteMs - spent + IncMs);
            else BlackMs = Math.Max(0, BlackMs - spent + IncMs);
        }
        TurnStartUtc = DateTime.UtcNow;
    }

    public string TryAssignSeat(string connId, string name, bool vsBot, string playAs, int botElo)
    {
        _botElo = Math.Clamp(botElo, 50, 3000);
        StartClockIfNeeded();

        if (vsBot)
        {
            var want = (playAs?.ToLowerInvariant()) switch
            {
                "black" => PieceColor.Black,
                "white" => PieceColor.White,
                _ => PieceColor.White
            };

            var botSeat = want == PieceColor.White ? PieceColor.Black : PieceColor.White;
            _botColor = botSeat;

            if (botSeat == PieceColor.White)
            {
                _whiteConn = null;
                _whiteName = $"BOT ({_botElo})";
            }
            else
            {
                _blackConn = null;
                _blackName = $"BOT ({_botElo})";
            }

            if (want == PieceColor.White)
            {
                if (_whiteConn == connId) return "white";
                if (_whiteConn is null)
                {
                    _whiteConn = connId;
                    _whiteName = name;
                    _blackName = $"BOT ({_botElo})";
                    return "white";
                }
            }
            else
            {
                if (_blackConn == connId) return "black";
                if (_blackConn is null)
                {
                    _blackConn = connId;
                    _blackName = name;
                    _whiteName = $"BOT ({_botElo})";
                    return "black";
                }
            }

            return "spectator";
        }

        _botColor = null;
        if (_whiteConn == connId) { _whiteName = name; return "white"; }
        if (_blackConn == connId) { _blackName = name; return "black"; }
        if (_whiteConn is null) { _whiteConn = connId; _whiteName = name; return "white"; }
        if (_blackConn is null) { _blackConn = connId; _blackName = name; return "black"; }
        return "spectator";
    }

    public bool Release(string connId)
    {
        bool changed = false;
        if (_whiteConn == connId)
        {
            _whiteConn = null;
            if (_botColor is null) _whiteName = "White";
            changed = true;
        }
        if (_blackConn == connId)
        {
            _blackConn = null;
            if (_botColor is null) _blackName = "Black";
            changed = true;
        }
        return changed;
    }

    public object ExportState()
    {
        int white = WhiteMs, black = BlackMs;
        if (TurnStartUtc is DateTime t0)
        {
            int spent = (int)(DateTime.UtcNow - t0).TotalMilliseconds;
            if (_board.Turn == PieceColor.White) white = Math.Max(0, white - spent);
            else black = Math.Max(0, black - spent);
        }

        var cells = new string[8][];
        for (int x = 0; x < 8; x++)
        {
            cells[x] = new string[8];
            for (int y = 0; y < 8; y++)
            {
                var p = _board.Cells[x, y];
                cells[x][y] = p.IsEmpty ? "." : $"{(p.Color == PieceColor.White ? "w" : "b")}_{p.Type.ToString().ToLower()}";
            }
        }

        var (wkx, wky) = _board.FindKing(PieceColor.White);
        var (bkx, bky) = _board.FindKing(PieceColor.Black);

        return new
        {
            board = cells,
            turn = _board.Turn.ToString().ToLower(),
            whiteMs = white,
            blackMs = black,
            lastMove = _lastMove,
            check = new
            {
                white = _board.IsInCheck(PieceColor.White),
                black = _board.IsInCheck(PieceColor.Black),
                wKing = new { x = wkx, y = wky },
                bKing = new { x = bkx, y = bky }
            },
            serverTimeMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        };
    }

    public IReadOnlyList<object> ExportHistory()
    {
        var list = new List<object>();
        var board = new Board();
        var uciMoves = BuildUciMoves(_history.Count);

        list.Add(new
        {
            ply = 0,
            moveNumber = 0,
            side = "none",
            san = "Startstellung",
            uci = string.Empty,
            eval = 0,
            fen = board.ToFen()
        });

        for (int i = 0; i < _history.Count; i++)
        {
            var rec = _history[i];
            var uci = uciMoves[i];
            ApplyUci(board, uci);

            list.Add(new
            {
                ply = i + 1,
                moveNumber = i / 2 + 1,
                side = (i % 2 == 0) ? "white" : "black",
                san = rec.Notation,
                uci,
                eval = rec.EvalAfterCp,
                fen = board.ToFen()
            });
        }

        return list;
    }

    public object ExportPlayers() => new
    {
        white = _botColor == PieceColor.White ? $"BOT ({_botElo})" : _whiteName,
        black = _botColor == PieceColor.Black ? $"BOT ({_botElo})" : _blackName
    };

    public string ExportCurrentFen() => _board.ToFen();

    public IReadOnlyList<object> GetLegalMoves(int fx, int fy)
    {
        if (!_board.InBounds(fx, fy)) return Array.Empty<object>();

        var piece = _board.Cells[fx, fy];
        if (piece.IsEmpty || piece.Color != _board.Turn)
            return Array.Empty<object>();

        var moves = new List<object>();
        foreach (var (sx, sy, tx, ty) in _board.AllLegalMoves(_board.Turn))
        {
            if (sx != fx || sy != fy) continue;
            var target = _board.Cells[tx, ty];
            bool isCapture = !target.IsEmpty;
            if (!isCapture && piece.Type == PieceType.Pawn && tx != fx)
            {
                if (_board.EnPassant is { } ep && ep.x == tx && ep.y == ty)
                    isCapture = true;
            }
            bool isPromotion = piece.Type == PieceType.Pawn && (ty == 0 || ty == 7);
            bool isCastle = piece.Type == PieceType.King && Math.Abs(tx - fx) == 2;
            moves.Add(new
            {
                tx,
                ty,
                capture = isCapture,
                promotion = isPromotion,
                castle = isCastle
            });
        }

        return moves;
    }

    private static readonly Dictionary<PieceType, int> Val = new()
    {
        [PieceType.Pawn] = 100,
        [PieceType.Knight] = 320,
        [PieceType.Bishop] = 330,
        [PieceType.Rook] = 500,
        [PieceType.Queen] = 900,
        [PieceType.King] = 20000
    };
    private int Score(Board b, PieceColor pov)
    {
        int s = 0;
        for (int y = 0; y < 8; y++)
            for (int x = 0; x < 8; x++)
            {
                var p = b.Cells[x, y];
                if (p.IsEmpty) continue;
                int v = Val[p.Type];
                s += (p.Color == pov) ? v : -v;
            }
        return s;
    }

    private static string Sq(int x, int y) => $"{(char)('a' + x)}{8 - y}";
    private string NotationFor(int fx, int fy, int tx, int ty, Piece moved, Piece captured, bool isMate, bool isCheck, string? promotion)
    {
        if (moved.Type == PieceType.King && Math.Abs(tx - fx) == 2) return (tx > fx) ? "O-O" : "O-O-O";
        string p = moved.Type switch
        {
            PieceType.Pawn => "",
            PieceType.Knight => "N",
            PieceType.Bishop => "B",
            PieceType.Rook => "R",
            PieceType.Queen => "Q",
            PieceType.King => "K",
            _ => ""
        };
        string cap = (!captured.IsEmpty) ? "x" : "";
        string san = $"{p}{cap}{Sq(tx, ty)}";
        if (moved.Type == PieceType.Pawn && !string.IsNullOrEmpty(promotion))
        {
            var promo = promotion.ToLowerInvariant();
            san += "=" + promo switch
            {
                "rook" => "R",
                "bishop" => "B",
                "knight" => "N",
                "queen" => "Q",
                _ => promo[0].ToString().ToUpperInvariant()
            };
        }
        if (isMate) san += "#"; else if (isCheck) san += "+";
        return san;
    }

    public MoveResult TryMove(string connId, int fx, int fy, int tx, int ty, string? promoteTo)
    {
        var expectedConn = _board.Turn == PieceColor.White ? _whiteConn : _blackConn;
        if (_botColor is PieceColor bot && bot == _board.Turn) expectedConn = null;
        if (expectedConn != null && expectedConn != connId)
            return new MoveResult { Ok = false, Error = "Not your seat" };

        var moved = _board.Cells[fx, fy];
        var wasTarget = _board.Cells[tx, ty];

        var res = _board.TryMove(fx, fy, tx, ty, promoteTo);
        if (!res.Ok) return res;

        _lastMove = (fx, fy, tx, ty);
        ApplyClockOnMove(moved.Color);

        var opp = _board.Turn;
        bool isCheck = _board.IsInCheck(opp);
        bool isMate = isCheck && !_board.HasAnyLegalMoves(opp);

        int evalAfter = Score(_board, moved.Color);
        var san = NotationFor(fx, fy, tx, ty, moved, wasTarget, isMate, isCheck, promoteTo);
        _history.Add(new MoveRec(fx, fy, tx, ty, san, evalAfter));

        return res;
    }

    public bool BotShouldMoveNow() => _botColor is PieceColor color && _board.Turn == color;

    public bool BotMove()
    {
        if (_botColor is not PieceColor color)
            return false;

        var ok = _bot.TryMakeMove(_board, color, _botElo, out var mv);
        if (ok)
        {
            ApplyClockOnMove(color);
            _lastMove = mv;
        }
        return ok;
    }

    public string? GetGameOverMessage()
    {
        var toMove = _board.Turn;
        if (_board.HasAnyLegalMoves(toMove)) return null;
        if (_board.IsInCheck(toMove))
            return toMove == PieceColor.White ? "Schachmatt – Schwarz gewinnt" : "Schachmatt – Weiß gewinnt";
        return "Patt – Remis";
    }

    // PGN
    public string ExportPgn(string eventName = "Casual", string site = "Localhost")
    {
        var sb = new StringBuilder();
        sb.AppendLine($"[Event \"{eventName}\"]");
        sb.AppendLine($"[Site \"{site}\"]");
        sb.AppendLine($"[White \"{(_botColor == PieceColor.White ? $"BOT ({_botElo})" : _whiteName)}\"]");
        sb.AppendLine($"[Black \"{(_botColor == PieceColor.Black ? $"BOT ({_botElo})" : _blackName)}\"]");
        sb.AppendLine($"[Date \"{DateTime.UtcNow:yyyy.MM.dd}\"]");
        for (int i = 0; i < _history.Count; i += 2)
        {
            int n = i / 2 + 1;
            sb.Append($"{n}. {_history[i].Notation} ");
            if (i + 1 < _history.Count) sb.Append($"{_history[i + 1].Notation} ");
        }
        sb.Append("*");
        return sb.ToString();
    }

    // UCI-список ходов для локального движка (Stockfish)
    public string ExportUciMoveList(int take = int.MaxValue)
        => string.Join(' ', BuildUciMoves(Math.Min(take, _history.Count)));

    private List<string> BuildUciMoves(int take)
    {
        static string Sq(int x, int y) => $"{(char)('a' + x)}{8 - y}";
        var b = new Board(); // стартовая позиция
        var parts = new List<string>();

        for (int i = 0; i < take; i++)
        {
            var m = _history[i];
            var p = b.Cells[m.Fx, m.Fy];
            var uci = $"{Sq(m.Fx, m.Fy)}{Sq(m.Tx, m.Ty)}";
            // Если пешка дошла до конца — по умолчанию ферзь (q)
            if (p.Type == PieceType.Pawn && (m.Ty == 0 || m.Ty == 7))
                uci += "q";
            b.TryMove(m.Fx, m.Fy, m.Tx, m.Ty, null);
            parts.Add(uci);
        }

        return parts;
    }

    // Встроенный быстрый анализ (ACPL, оценка «уровня»)
    public object BuildPostGameAnalysis()
    {
        var engineDepth = 3;

        int CpLossForColor(PieceColor color)
        {
            var b = new Board();
            int sumLoss = 0, cnt = 0;

            for (int i = 0; i < _history.Count; i++)
            {
                var m = _history[i];
                var mover = (i % 2 == 0) ? PieceColor.White : PieceColor.Black;

                var legal = b.AllLegalMoves(mover).ToList();
                if (legal.Count == 0) break;

                int best = mover == PieceColor.White ? int.MinValue : int.MaxValue;
                foreach (var l in legal)
                {
                    var c = b.Clone();
                    c.TryMove(l.fx, l.fy, l.tx, l.ty, null);
                    int sc = _bot.Evaluate(c, engineDepth - 1, PieceColor.White);
                    if (mover == PieceColor.White) best = Math.Max(best, sc);
                    else best = Math.Min(best, sc);
                }

                b.TryMove(m.Fx, m.Fy, m.Tx, m.Ty, null);
                int played = _bot.Evaluate(b, engineDepth - 1, PieceColor.White);

                int loss = mover == PieceColor.White
                    ? Math.Max(0, best - played)
                    : Math.Max(0, played - best);

                if (mover == color) { sumLoss += loss; cnt++; }
            }
            return (cnt == 0) ? 0 : (sumLoss / cnt);
        }

        int acplW = CpLossForColor(PieceColor.White);
        int acplB = CpLossForColor(PieceColor.Black);

        static int MapACPLToElo(int acpl) =>
            acpl <= 30 ? 2400 : acpl <= 50 ? 2200 : acpl <= 80 ? 2000 : acpl <= 120 ? 1800 :
            acpl <= 180 ? 1600 : acpl <= 250 ? 1400 : acpl <= 350 ? 1200 : 1000;

        return new
        {
            moves = _history.Count,
            white = new { acpl = acplW, estElo = MapACPLToElo(acplW) },
            black = new { acpl = acplB, estElo = MapACPLToElo(acplB) }
        };
    }

    public bool TryGetLastMoveAnalysisContext(out LastMoveAnalysisContext context)
    {
        if (_history.Count == 0)
        {
            context = default;
            return false;
        }

        var moves = BuildUciMoves(_history.Count);
        string uciAfter = string.Join(' ', moves);
        string uciBefore = moves.Count > 1 ? string.Join(' ', moves.Take(moves.Count - 1)) : string.Empty;

        var boardBefore = new Board();
        foreach (var mv in moves.Take(moves.Count - 1))
            ApplyUci(boardBefore, mv);

        var mover = (_history.Count % 2 == 1) ? PieceColor.White : PieceColor.Black;
        context = new LastMoveAnalysisContext(_history[^1], mover, uciBefore, uciAfter, moves[^1], boardBefore);
        return true;
    }

    public string ToSan(Board position, string uci)
    {
        if (string.IsNullOrWhiteSpace(uci)) return string.Empty;
        var (fx, fy, tx, ty, promotion) = ParseUci(uci);
        var moved = position.Cells[fx, fy];
        var captured = position.Cells[tx, ty];
        var future = position.Clone();
        future.TryMove(fx, fy, tx, ty, promotion);
        var opp = moved.Color == PieceColor.White ? PieceColor.Black : PieceColor.White;
        bool isCheck = future.IsInCheck(opp);
        bool isMate = isCheck && !future.HasAnyLegalMoves(opp);
        return NotationFor(fx, fy, tx, ty, moved, captured, isMate, isCheck, promotion);
    }

    public IReadOnlyList<string> ConvertPvToSan(Board position, string pv, int maxPlies = 6)
    {
        if (string.IsNullOrWhiteSpace(pv)) return Array.Empty<string>();
        var board = position.Clone();
        var list = new List<string>();
        var moves = pv.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        int take = Math.Min(maxPlies, moves.Length);
        for (int i = 0; i < take; i++)
        {
            var mv = moves[i];
            var san = ToSan(board, mv);
            if (string.IsNullOrEmpty(san)) break;
            list.Add(san);
            ApplyUci(board, mv);
        }
        return list;
    }

    private static (int fx, int fy, int tx, int ty, string? promotion) ParseUci(string uci)
    {
        int fx = uci[0] - 'a';
        int fy = 8 - (uci[1] - '0');
        int tx = uci[2] - 'a';
        int ty = 8 - (uci[3] - '0');
        string? promotion = null;
        if (uci.Length >= 5)
            promotion = uci[^1] switch
            {
                'q' => "queen",
                'r' => "rook",
                'b' => "bishop",
                'n' => "knight",
                _ => null
            };
        return (fx, fy, tx, ty, promotion);
    }

    private static void ApplyUci(Board board, string uci)
    {
        var (fx, fy, tx, ty, promotion) = ParseUci(uci);
        board.TryMove(fx, fy, tx, ty, promotion);
    }
}
