using System.Collections.Concurrent;
using Arcade.Core.Errors;
using Arcade.Core.Models;
using Arcade.Games.Minesweeper.Domain;

namespace Arcade.Games.Minesweeper.Engine;

public sealed class MinesweeperEngine
{
    private readonly ConcurrentDictionary<GameId, MinesweeperSession> _sessions = new();

    public MineField Create(string? roomId)
    {
        var id = Normalize(roomId);
        return _sessions.GetOrAdd(id, MinesweeperSession.Create).State;
    }

    public MineField Reveal(string roomId, int row, int column)
    {
        return GetSession(roomId).Reveal(row, column);
    }

    public MineField Reset(string roomId)
    {
        var id = Normalize(roomId);
        _sessions[id] = MinesweeperSession.Create(id);
        return _sessions[id].State;
    }

    public MineField GetState(string roomId) => GetSession(roomId).State;

    public MineResult? GetResult(string roomId) => GetSession(roomId).Result;

    public MineResult ForceWin(string roomId)
    {
        var session = GetSession(roomId);
        session.Result = new MineResult { GameId = session.State.GameId, Outcome = "WIN", Won = true, Reason = "DEV" };
        return session.Result;
    }

    public MineResult ForceLose(string roomId)
    {
        var session = GetSession(roomId);
        session.Result = new MineResult { GameId = session.State.GameId, Outcome = "LOSE", Won = false, Reason = "DEV" };
        return session.Result;
    }

    public MineResult ForceDraw(string roomId)
    {
        var session = GetSession(roomId);
        session.Result = new MineResult { GameId = session.State.GameId, Outcome = "DRAW", Won = false, Reason = "DEV" };
        return session.Result;
    }

    private MinesweeperSession GetSession(string roomId)
    {
        var id = Normalize(roomId);
        if (_sessions.TryGetValue(id, out var session))
        {
            return session;
        }

        throw new InvalidMoveException($"Minesweeper-Raum {roomId} existiert nicht.");
    }

    private static GameId Normalize(string? roomId) => string.IsNullOrWhiteSpace(roomId) ? GameId.New() : new GameId(roomId);

    private sealed class MinesweeperSession
    {
        private readonly bool[,] _mines;

        private MinesweeperSession(MineField state, bool[,] mines)
        {
            State = state;
            _mines = mines;
        }

        public MineField State { get; private set; }

        public MineResult? Result { get; set; }

        public static MinesweeperSession Create(GameId id)
        {
            var mines = new bool[5, 5];
            mines[1, 1] = true;
            mines[3, 3] = true;
            var cells = new List<IReadOnlyList<int>>(5);
            for (var r = 0; r < 5; r++)
            {
                var row = new int[5];
                for (var c = 0; c < 5; c++)
                {
                    row[c] = CountAdjacent(mines, r, c);
                }
                cells.Add(row);
            }

            var revealed = Enumerable.Range(0, 5).Select(_ => Enumerable.Repeat(false, 5).ToArray()).ToArray();
            var state = new MineField
            {
                GameId = id,
                Cells = cells,
                Revealed = revealed
            };

            return new MinesweeperSession(state, mines);
        }

        public MineField Reveal(int row, int column)
        {
            if (Result is not null || State.GameOver)
            {
                return State;
            }

            if (row is < 0 or > 4 || column is < 0 or > 4)
            {
                throw new InvalidMoveException("Koordinaten außerhalb des Feldes.");
            }

            var revealed = State.Revealed.Select(x => x.ToArray()).ToArray();
            revealed[row][column] = true;

            var gameOver = _mines[row, column];
            var won = false;
            if (!gameOver)
            {
                won = CheckWin(revealed);
            }

            State = State with
            {
                Revealed = revealed,
                GameOver = gameOver || won,
                Won = won,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            if (State.GameOver)
            {
                Result = new MineResult
                {
                    GameId = State.GameId,
                    Outcome = won ? "WIN" : "LOSE",
                    Won = won,
                    Reason = won ? "Alle Felder aufgedeckt" : "Mine getroffen"
                };
            }

            return State;
        }

        private static bool CheckWin(IReadOnlyList<IReadOnlyList<bool>> revealed)
        {
            for (var r = 0; r < revealed.Count; r++)
            {
                for (var c = 0; c < revealed[r].Count; c++)
                {
                    if (!revealed[r][c])
                    {
                        return false;
                    }
                }
            }

            return true;
        }

        private static int CountAdjacent(bool[,] mines, int row, int column)
        {
            if (mines[row, column])
            {
                return -1;
            }

            var count = 0;
            for (var r = row - 1; r <= row + 1; r++)
            {
                for (var c = column - 1; c <= column + 1; c++)
                {
                    if (r >= 0 && r < mines.GetLength(0) && c >= 0 && c < mines.GetLength(1) && mines[r, c])
                    {
                        count++;
                    }
                }
            }

            return count;
        }
    }
}
