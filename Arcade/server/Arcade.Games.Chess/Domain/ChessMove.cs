namespace Arcade.Games.Chess.Domain;

public sealed record ChessMove(int FromFile, int FromRank, int ToFile, int ToRank, PieceType Promotion = PieceType.None)
{
    public static ChessMove FromAlgebraic(string uci)
    {
        if (uci.Length is < 4 or > 5)
        {
            throw new ArgumentException("Invalid UCI move", nameof(uci));
        }

        var fromFile = uci[0] - 'a';
        var fromRank = 8 - (uci[1] - '0');
        var toFile = uci[2] - 'a';
        var toRank = 8 - (uci[3] - '0');
        var promotion = PieceType.None;

        if (uci.Length == 5)
        {
            promotion = uci[4] switch
            {
                'q' => PieceType.Queen,
                'r' => PieceType.Rook,
                'b' => PieceType.Bishop,
                'n' => PieceType.Knight,
                _ => PieceType.None
            };
        }

        return new ChessMove(fromFile, fromRank, toFile, toRank, promotion);
    }

    public override string ToString()
    {
        var from = $"{(char)('a' + FromFile)}{8 - FromRank}";
        var to = $"{(char)('a' + ToFile)}{8 - ToRank}";
        return Promotion is PieceType.None
            ? from + to
            : from + to + (Promotion switch
            {
                PieceType.Queen => "q",
                PieceType.Rook => "r",
                PieceType.Bishop => "b",
                PieceType.Knight => "n",
                _ => string.Empty
            });
    }
}
