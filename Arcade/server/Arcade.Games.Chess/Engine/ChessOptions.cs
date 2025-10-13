namespace Arcade.Games.Chess.Engine;

public sealed class ChessOptions
{
    public string StockfishPath { get; set; } = "stockfish";

    public int DefaultDepth { get; set; } = 14;

    public int BootTimeoutMs { get; set; } = 5000;

    public int ReadyTimeoutMs { get; set; } = 5000;

    public int SearchTimeoutMs { get; set; } = 10000;
}
