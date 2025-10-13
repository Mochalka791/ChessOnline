using System.Collections.Concurrent;
using Arcade.Core.Errors;
using Arcade.Core.Models;
using Arcade.Games.Tetris.Domain;

namespace Arcade.Games.Tetris.Engine;

public sealed class TetrisEngine
{
    private readonly ConcurrentDictionary<GameId, TetrisSession> _sessions = new();

    public TetrisState Create(string? roomId)
    {
        var id = Normalize(roomId);
        return _sessions.GetOrAdd(id, static gameId => new TetrisSession(gameId)).State;
    }

    public TetrisState Tick(string roomId)
    {
        return GetSession(roomId).Tick();
    }

    public TetrisState Move(string roomId, string action)
    {
        return GetSession(roomId).Move(action);
    }

    public TetrisState Reset(string roomId)
    {
        var id = Normalize(roomId);
        _sessions[id] = new TetrisSession(id);
        return _sessions[id].State;
    }

    public TetrisState GetState(string roomId) => GetSession(roomId).State;

    public TetrisResult? GetResult(string roomId) => GetSession(roomId).Result;

    public TetrisResult ForceWin(string roomId)
    {
        var session = GetSession(roomId);
        session.Result = new TetrisResult { GameId = session.State.GameId, Score = session.State.Score, Outcome = "WIN", Reason = "DEV" };
        return session.Result;
    }

    public TetrisResult ForceLose(string roomId)
    {
        var session = GetSession(roomId);
        session.Result = new TetrisResult { GameId = session.State.GameId, Score = session.State.Score, Outcome = "LOSE", Reason = "DEV" };
        return session.Result;
    }

    public TetrisResult ForceDraw(string roomId)
    {
        var session = GetSession(roomId);
        session.Result = new TetrisResult { GameId = session.State.GameId, Score = session.State.Score, Outcome = "DRAW", Reason = "DEV" };
        return session.Result;
    }

    private TetrisSession GetSession(string roomId)
    {
        var id = Normalize(roomId);
        if (_sessions.TryGetValue(id, out var session))
        {
            return session;
        }

        throw new InvalidMoveException($"Tetris-Raum {roomId} existiert nicht.");
    }

    private static GameId Normalize(string? roomId)
    {
        return string.IsNullOrWhiteSpace(roomId) ? GameId.New() : new GameId(roomId);
    }

    private sealed class TetrisSession
    {
        private readonly List<string> _well = new();
        private int _ticks;

        public TetrisSession(GameId id)
        {
            State = new TetrisState
            {
                GameId = id,
                Well = GenerateEmptyWell(),
                ActivePiece = "I"
            };
        }

        public TetrisState State { get; private set; }

        public TetrisResult? Result { get; set; }

        public TetrisState Tick()
        {
            if (Result is not null)
            {
                return State;
            }

            _ticks++;
            var lines = State.LinesCleared + (_ticks % 4 == 0 ? 1 : 0);
            var score = State.Score + 40;
            var level = 1 + lines / 10;

            State = State with
            {
                LinesCleared = lines,
                Score = score,
                Level = level,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            if (lines >= 40)
            {
                Result = new TetrisResult
                {
                    GameId = State.GameId,
                    Score = score,
                    Outcome = "WIN",
                    Reason = "Level abgeschlossen"
                };
            }

            return State;
        }

        public TetrisState Move(string action)
        {
            if (Result is not null)
            {
                return State;
            }

            State = State with
            {
                ActivePiece = action,
                UpdatedAt = DateTimeOffset.UtcNow
            };
            return State;
        }

        private static IReadOnlyList<string> GenerateEmptyWell()
        {
            var rows = new List<string>(20);
            for (var i = 0; i < 20; i++)
            {
                rows.Add(new string('.', 10));
            }

            return rows;
        }
    }
}
