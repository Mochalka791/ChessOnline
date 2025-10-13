using Arcade.Games.Chess.Domain;
using Arcade.Games.Chess.Rules;
using Xunit;

namespace Arcade.Games.Chess.Tests;

public sealed class ChessGameManagerTests
{
    [Fact]
    public void Create_Returns_New_GameId()
    {
        var manager = new ChessGameManager(new MoveValidator());
        var state = manager.Create(null);
        Assert.False(string.IsNullOrWhiteSpace(state.GameId.Value));
    }

    [Fact]
    public void ApplyMove_Updates_Turn()
    {
        var manager = new ChessGameManager(new MoveValidator());
        var state = manager.Create(null);
        var move = ChessMove.FromAlgebraic("e2e4");
        state = manager.ApplyMove(state.GameId.Value, move);
        Assert.Equal(PieceColor.Black, state.ActiveColor);
    }
}
