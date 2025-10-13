namespace Arcade.Core.Abstractions;

using Arcade.Core.Models;

public interface IGameStateSerializer<TState>
    where TState : GameState
{
    string Serialize(TState state);

    TState Deserialize(string payload);
}
