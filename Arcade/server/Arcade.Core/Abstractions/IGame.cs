namespace Arcade.Core.Abstractions;

using Arcade.Core.Models;

public interface IGame<TMove, TState, TResult>
    where TMove : Move
    where TState : GameState
    where TResult : GameResult
{
    GameId Id { get; }

    ValueTask<TState> CreateAsync(CancellationToken cancellationToken = default);

    ValueTask<TState> ApplyMoveAsync(GameId gameId, TMove move, CancellationToken cancellationToken = default);

    ValueTask<TState> GetStateAsync(GameId gameId, CancellationToken cancellationToken = default);

    ValueTask<TResult?> GetResultAsync(GameId gameId, CancellationToken cancellationToken = default);
}
