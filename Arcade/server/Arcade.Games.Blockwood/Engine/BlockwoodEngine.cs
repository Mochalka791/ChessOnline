using System.Collections.Concurrent;
using Arcade.Core.Errors;
using Arcade.Core.Models;
using Arcade.Games.Blockwood.Domain;

namespace Arcade.Games.Blockwood.Engine;

public sealed class BlockwoodEngine
{
    private readonly ConcurrentDictionary<GameId, BlockwoodSession> _sessions = new();

    public BlockwoodState Create(string? roomId)
    {
        var id = Normalize(roomId);
        return _sessions.GetOrAdd(id, static gameId => new BlockwoodSession(gameId)).State;
    }

    public BlockwoodState Move(string roomId)
    {
        return GetSession(roomId).Move();
    }

    public BlockwoodState Reset(string roomId)
    {
        var id = Normalize(roomId);
        _sessions[id] = new BlockwoodSession(id);
        return _sessions[id].State;
    }

    public BlockwoodState GetState(string roomId) => GetSession(roomId).State;

    public BlockwoodResult? GetResult(string roomId) => GetSession(roomId).Result;

    public BlockwoodResult ForceWin(string roomId)
    {
        var session = GetSession(roomId);
        session.Result = new BlockwoodResult { GameId = session.State.GameId, Outcome = "WIN", Moves = session.State.Moves, Reason = "DEV" };
        return session.Result;
    }

    public BlockwoodResult ForceLose(string roomId)
    {
        var session = GetSession(roomId);
        session.Result = new BlockwoodResult { GameId = session.State.GameId, Outcome = "LOSE", Moves = session.State.Moves, Reason = "DEV" };
        return session.Result;
    }

    public BlockwoodResult ForceDraw(string roomId)
    {
        var session = GetSession(roomId);
        session.Result = new BlockwoodResult { GameId = session.State.GameId, Outcome = "DRAW", Moves = session.State.Moves, Reason = "DEV" };
        return session.Result;
    }

    private BlockwoodSession GetSession(string roomId)
    {
        var id = Normalize(roomId);
        if (_sessions.TryGetValue(id, out var session))
        {
            return session;
        }

        throw new InvalidMoveException($"Blockwood-Raum {roomId} existiert nicht.");
    }

    private static GameId Normalize(string? roomId) => string.IsNullOrWhiteSpace(roomId) ? GameId.New() : new GameId(roomId);

    private sealed class BlockwoodSession
    {
        public BlockwoodSession(GameId id)
        {
            State = new BlockwoodState
            {
                GameId = id,
                TargetMoves = 40
            };
        }

        public BlockwoodState State { get; private set; }

        public BlockwoodResult? Result { get; set; }

        public BlockwoodState Move()
        {
            if (Result is not null)
            {
                return State;
            }

            var moves = State.Moves + 1;
            var solved = moves >= State.TargetMoves;
            State = State with
            {
                Moves = moves,
                Solved = solved,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            if (solved)
            {
                Result = new BlockwoodResult
                {
                    GameId = State.GameId,
                    Outcome = "WIN",
                    Moves = moves,
                    Reason = "Puzzle gelöst"
                };
            }

            return State;
        }
    }
}
