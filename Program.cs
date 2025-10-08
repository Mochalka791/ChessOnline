using ChessOnline;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = WebApplication.CreateBuilder(args);

// Сервисы
builder.Services.AddSignalR();
builder.Services.AddSingleton<IGameStore, InMemoryGameStore>();
builder.Services.AddHttpClient();
builder.Services.AddSingleton<StockfishEngine>(); // локальный движок Stockfish

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

// SignalR-хаб
app.MapHub<ChessHub>("/chess");

// ===== ЛОКАЛЬНЫЙ БЕСПЛАТНЫЙ АНАЛИЗ (Stockfish) =====
// GET /api/local/analyze?roomId=testroom&depth=14
app.MapGet("/api/local/analyze", async (
    IGameStore store,
    StockfishEngine engine,
    string roomId,
    int depth) =>
{
    try
    {
        depth = depth is > 4 and <= 30 ? depth : 14;

        var game = store.GetOrCreate(roomId);
        var uci = game.ExportUciMoveList(); // метод в ChessGame.cs

        var eval = await engine.AnalyzeAsync(uci, depth);
        var text = eval.ScoreType == "mate"
            ? $"Mate in {eval.Score}  |  best: {eval.BestMove}\nPV: {eval.Pv}"
            : $"Eval {eval.Score / 100.0:+0.00;-0.00}  |  depth {eval.Depth}  |  best: {eval.BestMove}\nPV: {eval.Pv}";

        return Results.Json(new { ok = true, text });
    }
    catch (Exception ex)
    {
        var message = ex switch
        {
            FileNotFoundException or TimeoutException => ex.Message,
            _ => "Local analysis failed to run. Check Stockfish installation."
        };

        return Results.Json(new { ok = false, error = message }, statusCode: StatusCodes.Status500InternalServerError);
    }
});

app.Run();
