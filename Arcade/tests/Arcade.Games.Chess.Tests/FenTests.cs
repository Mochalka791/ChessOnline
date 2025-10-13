using Arcade.Games.Chess.Domain;
using Xunit;

namespace Arcade.Games.Chess.Tests;

public sealed class FenTests
{
    [Fact]
    public void Generates_Starting_Fen()
    {
        var board = new ChessBoard();
        var fen = FEN.FromBoard(board);
        Assert.StartsWith("rnbqkbnr/pppppppp/", fen);
        Assert.Contains(" w ", fen);
    }
}
