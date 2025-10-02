using Microsoft.AspNetCore.SignalR;

namespace ChessOnline;

public class ChessHub(IGameStore store) : Hub
{
    public async Task JoinRoom(string roomId, string playerName, bool vsBot, string playAs, int elo)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, roomId);

        var game = store.GetOrCreate(roomId);
        var seat = game.TryAssignSeat(Context.ConnectionId, playerName, vsBot, playAs, elo);

        await Clients.Caller.SendAsync("Init", game.ExportState(), seat);
        await Clients.Caller.SendAsync("History", game.ExportHistory());
        await Clients.Group(roomId).SendAsync("Players", game.ExportPlayers());

        if (game.BotShouldMoveNow() && game.BotMove())
        {
            await Clients.Group(roomId).SendAsync("State", game.ExportState());
            await Clients.Group(roomId).SendAsync("History", game.ExportHistory());
            var over = game.GetGameOverMessage();
            if (over is not null)
                await Clients.Group(roomId).SendAsync("GameOver", over, game.BuildPostGameAnalysis());
        }
    }

    public async Task MakeMove(string roomId, int fromX, int fromY, int toX, int toY, string? promoteTo)
    {
        var game = store.GetOrCreate(roomId);
        var res = game.TryMove(Context.ConnectionId, fromX, fromY, toX, toY, promoteTo);

        await Clients.Caller.SendAsync("MoveResult", res.Ok, res.Error);

        if (res.Ok)
        {
            await Clients.Group(roomId).SendAsync("State", game.ExportState());
            await Clients.Group(roomId).SendAsync("History", game.ExportHistory());

            var over = game.GetGameOverMessage();
            if (over is not null)
            {
                await Clients.Group(roomId).SendAsync("GameOver", over, game.BuildPostGameAnalysis());
                return;
            }

            if (game.BotShouldMoveNow() && game.BotMove())
            {
                await Clients.Group(roomId).SendAsync("State", game.ExportState());
                await Clients.Group(roomId).SendAsync("History", game.ExportHistory());
                over = game.GetGameOverMessage();
                if (over is not null)
                    await Clients.Group(roomId).SendAsync("GameOver", over, game.BuildPostGameAnalysis());
            }
        }
    }

    public Task<string> GetPgn(string roomId)
    {
        var game = store.GetOrCreate(roomId);
        return Task.FromResult(game.ExportPgn());
    }

    public override async Task OnDisconnectedAsync(Exception? ex)
    {
        var left = store.ReleaseByConnection(Context.ConnectionId);
        if (left is not null)
            await Clients.Group(left.Value.RoomId).SendAsync("Players", left.Value.Game.ExportPlayers());
        await base.OnDisconnectedAsync(ex);
    }
}
