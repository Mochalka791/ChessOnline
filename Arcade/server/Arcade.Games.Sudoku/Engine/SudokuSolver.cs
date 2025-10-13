namespace Arcade.Games.Sudoku.Engine;

public static class SudokuSolver
{
    public static bool IsSolved(int[,] grid)
    {
        for (var i = 0; i < 9; i++)
        {
            if (!CheckSet(GetRow(grid, i)) || !CheckSet(GetColumn(grid, i)))
            {
                return false;
            }
        }

        for (var row = 0; row < 9; row += 3)
        {
            for (var col = 0; col < 9; col += 3)
            {
                if (!CheckSet(GetBlock(grid, row, col)))
                {
                    return false;
                }
            }
        }

        return true;
    }

    private static int[] GetRow(int[,] grid, int row)
    {
        var result = new int[9];
        for (var col = 0; col < 9; col++)
        {
            result[col] = grid[row, col];
        }
        return result;
    }

    private static int[] GetColumn(int[,] grid, int column)
    {
        var result = new int[9];
        for (var row = 0; row < 9; row++)
        {
            result[row] = grid[row, column];
        }
        return result;
    }

    private static int[] GetBlock(int[,] grid, int row, int column)
    {
        var result = new int[9];
        var index = 0;
        for (var r = row; r < row + 3; r++)
        {
            for (var c = column; c < column + 3; c++)
            {
                result[index++] = grid[r, c];
            }
        }
        return result;
    }

    private static bool CheckSet(int[] values)
    {
        var seen = new HashSet<int>();
        foreach (var value in values)
        {
            if (value is < 1 or > 9)
            {
                return false;
            }

            if (!seen.Add(value))
            {
                return false;
            }
        }

        return seen.Count == 9;
    }
}
