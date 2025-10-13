using System.Collections.Concurrent;
using Arcade.Core.Errors;
using Arcade.Core.Models;
using Arcade.Games.Chess.Rules;

namespace Arcade.Games.Chess.Domain;

public sealed class ChessGameManager
{
    private readonly ConcurrentDictionary<GameId, ChessMatch> _matches = new();
    private readonly MoveValidator _validator;

    public ChessGameManager(MoveValidator validator)
    {
        _validator = validator;
    }

    public ChessState Create(string? requestedId)
    {
        var gameId = NormalizeId(requestedId);
        var match = _matches.GetOrAdd(gameId, id => new ChessMatch(id, _validator));
        return match.GetState();
    }

    public ChessState ApplyMove(string roomId, ChessMove move)
    {
        var match = GetMatch(NormalizeId(roomId));
        return match.ApplyMove(move);
    }

    public ChessState GetState(string roomId)
    {
        var match = GetMatch(NormalizeId(roomId));
        return match.GetState();
    }

    public ChessResult? GetResult(string roomId)
    {
        var match = GetMatch(NormalizeId(roomId));
        return match.GetResult();
    }

    public void Reset(string roomId)
    {
        var id = NormalizeId(roomId);
        _matches[id] = new ChessMatch(id, _validator);
    }

    public ChessResult ForceWin(string roomId)
    {
        var match = GetMatch(NormalizeId(roomId));
        return match.ForceOutcome(PieceColor.White, "1-0", "Forciert (DEV)");
    }

    public ChessResult ForceLose(string roomId)
    {
        var match = GetMatch(NormalizeId(roomId));
        return match.ForceOutcome(PieceColor.Black, "0-1", "Forciert (DEV)");
    }

    public ChessResult ForceDraw(string roomId)
    {
        var match = GetMatch(NormalizeId(roomId));
        return match.ForceOutcome(null, "½-½", "Remis (DEV)");
    }

    private ChessMatch GetMatch(GameId id)
    {
        if (_matches.TryGetValue(id, out var match))
        {
            return match;
        }

        throw new InvalidMoveException($"Spiel {id} wurde nicht gefunden.");
    }

    private static GameId NormalizeId(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return GameId.New();
        }

        return new GameId(value);
    }
}
