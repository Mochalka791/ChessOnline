namespace Arcade.Core.Errors;

public sealed class InvalidMoveException : Exception
{
    public InvalidMoveException(string message)
        : base(message)
    {
    }

    public InvalidMoveException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
