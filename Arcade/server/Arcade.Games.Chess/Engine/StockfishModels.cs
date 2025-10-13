namespace Arcade.Games.Chess.Engine;

public sealed record StockfishRequest(string Fen, int Depth);

public sealed record StockfishResponse(string BestMove, int? Centipawns, int? Mate, IReadOnlyList<string> PrincipalVariation);
