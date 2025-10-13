using System.Collections.Concurrent;
using Arcade.Core.Errors;
using Arcade.Core.Models;
using Arcade.Games.Snake.Domain;
using Microsoft.Extensions.Logging;

namespace Arcade.Games.Snake.Engine;

public enum SnakeDirection
{
    Up,
    Down,
    Left,
    Right
}

public sealed class SnakeEngine
{
    private readonly ConcurrentDictionary<GameId, SnakeSession> _sessions = new();
    private readonly ILogger<SnakeEngine> _logger;
    private readonly Random _random = new();

    public SnakeEngine(ILogger<SnakeEngine> logger)
    {
        _logger = logger;
    }

    public SnakeState Create(string? requestedId)
    {
        var id = Normalize(requestedId);
        var session = _sessions.GetOrAdd(id, gameId => SnakeSession.New(gameId, _random));
        return session.State;
    }

    public SnakeState Move(string roomId, SnakeDirection direction)
    {
        var session = GetSession(roomId);
        session.Step(direction, _random);
        return session.State;
    }

    public SnakeState Reset(string roomId)
    {
        var id = Normalize(roomId);
        _sessions[id] = SnakeSession.New(id, _random);
        return _sessions[id].State;
    }

    public SnakeState GetState(string roomId) => GetSession(roomId).State;

    public SnakeResult? GetResult(string roomId) => GetSession(roomId).Result;

    public SnakeResult ForceWin(string roomId)
    {
        var session = GetSession(roomId);
        session.Result = new SnakeResult { GameId = session.State.GameId, Outcome = "WIN", Score = session.State.Score, Reason = "DEV" };
        return session.Result;
    }

    public SnakeResult ForceLose(string roomId)
    {
        var session = GetSession(roomId);
        session.Result = new SnakeResult { GameId = session.State.GameId, Outcome = "LOSE", Score = session.State.Score, Reason = "DEV" };
        return session.Result;
    }

    public SnakeResult ForceDraw(string roomId)
    {
        var session = GetSession(roomId);
        session.Result = new SnakeResult { GameId = session.State.GameId, Outcome = "DRAW", Score = session.State.Score, Reason = "DEV" };
        return session.Result;
    }

    private SnakeSession GetSession(string roomId)
    {
        var id = Normalize(roomId);
        if (_sessions.TryGetValue(id, out var session))
        {
            return session;
        }

        throw new InvalidMoveException($"Snake-Raum {roomId} existiert nicht.");
    }

    private GameId Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return GameId.New();
        }

        return new GameId(value);
    }

    private sealed class SnakeSession
    {
        private SnakeDirection _direction;

        public SnakeSession(SnakeState state, SnakeDirection direction)
        {
            State = state;
            _direction = direction;
        }

        public SnakeState State { get; private set; }

        public SnakeResult? Result { get; set; }

        public static SnakeSession New(GameId id, Random random)
        {
            var body = new List<(int X, int Y)> { (5, 8), (5, 9), (5, 10) };
            var state = new SnakeState
            {
                GameId = id,
                Body = body,
                Food = (10, 5),
                Score = 0,
                Alive = true
            };

            return new SnakeSession(state, SnakeDirection.Up);
        }

        public void Step(SnakeDirection direction, Random random)
        {
            if (!State.Alive)
            {
                return;
            }

            if (IsOpposite(direction, _direction))
            {
                direction = _direction;
            }

            _direction = direction;
            var head = State.Body[0];
            var next = direction switch
            {
                SnakeDirection.Up => (head.X, head.Y - 1),
                SnakeDirection.Down => (head.X, head.Y + 1),
                SnakeDirection.Left => (head.X - 1, head.Y),
                SnakeDirection.Right => (head.X + 1, head.Y),
                _ => head
            };

            var body = State.Body.ToList();
            body.Insert(0, next);

            var food = State.Food;
            var score = State.Score;
            if (next == food)
            {
                score += 10;
                food = RandomFood(random, body, State.Width, State.Height);
            }
            else
            {
                body.RemoveAt(body.Count - 1);
            }

            var alive = next.X is >= 0 and < 16 && next.Y is >= 0 and < 16 && body.Skip(1).All(p => p != next);

            State = State with
            {
                Body = body,
                Food = food,
                Score = score,
                Alive = alive,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            if (!alive)
            {
                Result = new SnakeResult
                {
                    GameId = State.GameId,
                    Outcome = "LOSE",
                    Reason = "Kollision",
                    Score = score
                };
            }
        }

        private static (int X, int Y) RandomFood(Random random, IReadOnlyCollection<(int X, int Y)> body, int width, int height)
        {
            var empty = new List<(int X, int Y)>();
            for (var x = 0; x < width; x++)
            {
                for (var y = 0; y < height; y++)
                {
                    if (body.All(p => p.X != x || p.Y != y))
                    {
                        empty.Add((x, y));
                    }
                }
            }

            return empty.Count == 0 ? (0, 0) : empty[random.Next(empty.Count)];
        }

        private static bool IsOpposite(SnakeDirection a, SnakeDirection b) =>
            (a, b) switch
            {
                (SnakeDirection.Up, SnakeDirection.Down) => true,
                (SnakeDirection.Down, SnakeDirection.Up) => true,
                (SnakeDirection.Left, SnakeDirection.Right) => true,
                (SnakeDirection.Right, SnakeDirection.Left) => true,
                _ => false
            };
    }
}
