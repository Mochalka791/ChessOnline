namespace ChessOnline;

public enum PieceType { None, Pawn, Rook, Knight, Bishop, Queen, King }
public enum PieceColor { White, Black }

public readonly record struct Piece(PieceType Type, PieceColor Color)
{
    public static readonly Piece Empty = new(PieceType.None, PieceColor.White);
    public bool IsEmpty => Type == PieceType.None;
}

public sealed class MoveResult
{
    public bool Ok { get; init; }
    public string? Error { get; init; }
}

public sealed record MoveRec(int Fx, int Fy, int Tx, int Ty, string Notation, int EvalAfterCp);

public interface IGameStore
{
    ChessGame GetOrCreate(string roomId);
    (string RoomId, ChessGame Game)? ReleaseByConnection(string connectionId);
}

public sealed class InMemoryGameStore : IGameStore
{
    private readonly Dictionary<string, ChessGame> _games = new();
    private readonly object _lock = new();

    public ChessGame GetOrCreate(string roomId)
    {
        lock (_lock)
        {
            if (!_games.TryGetValue(roomId, out var g))
            {
                g = new ChessGame(roomId);
                _games[roomId] = g;
            }
            return g;
        }
    }

    public (string RoomId, ChessGame Game)? ReleaseByConnection(string connectionId)
    {
        lock (_lock)
        {
            foreach (var kv in _games)
            {
                if (kv.Value.Release(connectionId))
                    return (kv.Key, kv.Value);
            }
            return null;
        }
    }
}
