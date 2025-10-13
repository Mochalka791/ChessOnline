using Arcade.Games.Chess.Domain;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace Arcade.Games.Chess.Realtime;

public sealed class ChessHub : Hub
{
    private readonly ChessGameManager _games;
    private readonly ILogger<ChessHub> _logger;

    public ChessHub(ChessGameManager games, ILogger<ChessHub> logger)
    {
        _games = games;
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Client {ConnectionId} verbunden", Context.ConnectionId);
        await base.OnConnectedAsync().ConfigureAwait(false);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (exception is not null)
        {
            _logger.LogWarning(exception, "Client {ConnectionId} getrennt", Context.ConnectionId);
        }
        else
        {
            _logger.LogInformation("Client {ConnectionId} getrennt", Context.ConnectionId);
        }

        await base.OnDisconnectedAsync(exception).ConfigureAwait(false);
    }

    public async Task JoinRoom(string roomId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, roomId).ConfigureAwait(false);
        await Clients.Caller.SendAsync("joined", roomId).ConfigureAwait(false);
    }

    public Task LeaveRoom(string roomId) => Groups.RemoveFromGroupAsync(Context.ConnectionId, roomId);

    public async Task BroadcastState(string roomId)
    {
        var state = _games.GetState(roomId);
        await Clients.Group(roomId).SendAsync("state", state).ConfigureAwait(false);
    }
}
