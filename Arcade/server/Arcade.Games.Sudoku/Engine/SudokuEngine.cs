using System.Collections.Concurrent;
using Arcade.Core.Errors;
using Arcade.Core.Models;
using Arcade.Games.Sudoku.Domain;

namespace Arcade.Games.Sudoku.Engine;

public sealed class SudokuEngine
{
    private readonly ConcurrentDictionary<GameId, SudokuSession> _sessions = new();

    public SudokuGrid Create(string? roomId)
    {
        var id = Normalize(roomId);
        return _sessions.GetOrAdd(id, SudokuSession.Create).State;
    }

    public SudokuGrid Validate(string roomId, int row, int column, int value)
    {
        return GetSession(roomId).SetCell(row, column, value);
    }

    public SudokuGrid Reset(string roomId)
    {
        var id = Normalize(roomId);
        _sessions[id] = SudokuSession.Create(id);
        return _sessions[id].State;
    }

    public SudokuGrid GetState(string roomId) => GetSession(roomId).State;

    public SudokuResult? GetResult(string roomId) => GetSession(roomId).Result;

    public SudokuResult ForceWin(string roomId)
    {
        var session = GetSession(roomId);
        session.Result = new SudokuResult { GameId = session.State.GameId, Outcome = "WIN", HintsUsed = session.State.HintsUsed, Reason = "DEV" };
        return session.Result;
    }

    public SudokuResult ForceLose(string roomId)
    {
        var session = GetSession(roomId);
        session.Result = new SudokuResult { GameId = session.State.GameId, Outcome = "LOSE", HintsUsed = session.State.HintsUsed, Reason = "DEV" };
        return session.Result;
    }

    public SudokuResult ForceDraw(string roomId)
    {
        var session = GetSession(roomId);
        session.Result = new SudokuResult { GameId = session.State.GameId, Outcome = "DRAW", HintsUsed = session.State.HintsUsed, Reason = "DEV" };
        return session.Result;
    }

    private SudokuSession GetSession(string roomId)
    {
        var id = Normalize(roomId);
        if (_sessions.TryGetValue(id, out var session))
        {
            return session;
        }

        throw new InvalidMoveException($"Sudoku-Raum {roomId} existiert nicht.");
    }

    private static GameId Normalize(string? roomId) => string.IsNullOrWhiteSpace(roomId) ? GameId.New() : new GameId(roomId);

    private sealed class SudokuSession
    {
        private readonly int[,] _solution;

        private SudokuSession(SudokuGrid state, int[,] solution)
        {
            State = state;
            _solution = solution;
        }

        public SudokuGrid State { get; private set; }

        public SudokuResult? Result { get; set; }

        public static SudokuSession Create(GameId id)
        {
            var (puzzle, solution) = SudokuGenerator.CreatePuzzle();
            var rows = new List<int[]>(9);
            for (var r = 0; r < 9; r++)
            {
                var row = new int[9];
                for (var c = 0; c < 9; c++)
                {
                    row[c] = puzzle[r, c];
                }
                rows.Add(row);
            }

            var state = new SudokuGrid
            {
                GameId = id,
                Cells = rows
            };

            return new SudokuSession(state, solution);
        }

        public SudokuGrid SetCell(int row, int column, int value)
        {
            if (Result is not null)
            {
                return State;
            }

            if (row is < 0 or > 8 || column is < 0 or > 8)
            {
                throw new InvalidMoveException("Koordinaten außerhalb des Gitters.");
            }

            var current = State.Cells[row][column];
            if (current != 0)
            {
                throw new InvalidMoveException("Feld ist fixiert.");
            }

            var cells = State.Cells.Select(x => x.ToArray()).ToArray();
            cells[row][column] = value;

            var solved = SudokuSolver.IsSolved(ToMatrix(cells));
            State = State with
            {
                Cells = cells,
                Solved = solved,
                UpdatedAt = DateTimeOffset.UtcNow
            };

            if (solved)
            {
                Result = new SudokuResult
                {
                    GameId = State.GameId,
                    Outcome = "WIN",
                    HintsUsed = State.HintsUsed,
                    Reason = "Sudoku gelöst"
                };
            }

            return State;
        }

        private static int[,] ToMatrix(IReadOnlyList<int[]> rows)
        {
            var grid = new int[9, 9];
            for (var r = 0; r < 9; r++)
            {
                for (var c = 0; c < 9; c++)
                {
                    grid[r, c] = rows[r][c];
                }
            }

            return grid;
        }
    }
}
