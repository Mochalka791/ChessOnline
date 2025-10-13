namespace Arcade.Core.Errors;

public sealed class EngineUnavailableException : Exception
{
    public EngineUnavailableException(string message)
        : base(message)
    {
    }

    public EngineUnavailableException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
