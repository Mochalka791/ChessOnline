using Arcade.Games.Chess.Domain;
using Arcade.Games.Chess.Rules;
using Xunit;

namespace Arcade.Games.Chess.Tests;

public sealed class MoveValidatorTests
{
    [Fact]
    public void Allows_Opening_KingPawn_Push()
    {
        var board = new ChessBoard();
        var validator = new MoveValidator();
        var move = new ChessMove(4, 6, 4, 4);

        Assert.True(validator.TryValidate(board, move, out var error), error);
    }

    [Fact]
    public void Rejects_Illegal_Knight_Move()
    {
        var board = new ChessBoard();
        var validator = new MoveValidator();
        var move = new ChessMove(1, 7, 1, 5);

        Assert.False(validator.TryValidate(board, move, out _));
    }
}
