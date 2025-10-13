namespace Arcade.Core.Models;

public readonly record struct GameId(string Value)
{
    public static GameId New() => new(Guid.NewGuid().ToString("N"));

    public override string ToString() => Value;
}
