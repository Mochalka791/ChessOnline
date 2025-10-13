namespace Arcade.Core.Abstractions;

public interface IGameEngine<TCommand, TResult>
{
    ValueTask<TResult> ExecuteAsync(TCommand command, CancellationToken cancellationToken = default);
}
