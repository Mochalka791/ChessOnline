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

        if (!game.TryGetLastMoveAnalysisContext(out var ctx))
        {
            var eval = await engine.AnalyzeAsync(game.ExportUciMoveList(), depth);
            var summary = new
            {
                mover = "none",
                moveSan = "(no moves)",
                evaluationBefore = FormatEvalDisplay(eval, invertPerspective: false),
                evaluationAfter = FormatEvalDisplay(eval, invertPerspective: false),
                cpBefore = RoundCp(NormalizeEval(eval, invertPerspective: false)),
                cpAfter = RoundCp(NormalizeEval(eval, invertPerspective: false)),
                swing = 0,
                judgement = "Overview",
                severity = "info",
                comment = "The game has not started yet. Make a move to get feedback.",
                bestSan = string.Empty,
                pvSan = Array.Empty<string>()
            };

            return Results.Json(new { ok = true, depth = eval.Depth, summary });
        }

        var beforeEval = await engine.AnalyzeAsync(ctx.UciBefore, depth);
        var afterEval = await engine.AnalyzeAsync(ctx.UciAfter, depth);

        var cpBefore = NormalizeEval(beforeEval, invertPerspective: false);
        var cpAfter = NormalizeEval(afterEval, invertPerspective: true);
        var swing = cpAfter - cpBefore;

        var (label, severity, comment) = ClassifyMove(swing, afterEval);
        var mover = ctx.Mover == PieceColor.White ? "White" : "Black";

        string bestSan = string.Empty;
        if (!string.IsNullOrWhiteSpace(beforeEval.BestMove) && beforeEval.BestMove != "(none)" &&
            !string.Equals(beforeEval.BestMove, ctx.LastMoveUci, StringComparison.OrdinalIgnoreCase))
        {
            bestSan = game.ToSan(ctx.PositionBefore, beforeEval.BestMove);
        }

        var pvSan = game.ConvertPvToSan(ctx.PositionBefore, beforeEval.Pv, 6);

        var summary = new
        {
            mover,
            moveSan = ctx.LastMove.Notation,
            evaluationBefore = FormatEvalDisplay(beforeEval, invertPerspective: false),
            evaluationAfter = FormatEvalDisplay(afterEval, invertPerspective: true),
            cpBefore = RoundCp(cpBefore),
            cpAfter = RoundCp(cpAfter),
            swing = RoundCp(swing),
            judgement = label,
            severity,
            comment,
            bestSan,
            bestUci = beforeEval.BestMove,
            pvSan,
            depthUsed = Math.Min(beforeEval.Depth, afterEval.Depth)
        };

        return Results.Json(new { ok = true, depth = summary.depthUsed, summary });
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

static double NormalizeEval(StockfishEngine.EngineEval eval, bool invertPerspective)
{
    double value = eval.ScoreType == "mate"
        ? (eval.Score > 0 ? 100_000 - Math.Min(Math.Abs(eval.Score), 50) * 1_000 : -100_000 + Math.Min(Math.Abs(eval.Score), 50) * 1_000)
        : eval.Score;
    return invertPerspective ? -value : value;
}

static string FormatEvalDisplay(StockfishEngine.EngineEval eval, bool invertPerspective)
{
    if (eval.ScoreType == "mate")
    {
        int mate = invertPerspective ? -eval.Score : eval.Score;
        if (mate == 0) return "#0";
        var sign = mate > 0 ? "#" : "-#";
        return $"{sign}{Math.Abs(mate)}";
    }

    var cp = NormalizeEval(eval, invertPerspective);
    return (cp / 100.0).ToString("+0.00;-0.00");
}

static (string Label, string Severity, string Comment) ClassifyMove(double swing, StockfishEngine.EngineEval after)
{
    // Positive swing = mover improved their position.
    if (after.ScoreType == "mate")
    {
        if (after.Score > 0)
            return ("Blunder", "blunder", $"Allows mate in {after.Score}.");
        if (after.Score < 0)
            return ("Winning", "brilliant", $"Forces mate in {Math.Abs(after.Score)}.");
    }

    var roundedSwing = RoundCp(swing);
    if (roundedSwing >= 80)
        return ("Brilliant", "brilliant", $"Improves the evaluation by {roundedSwing} cp.");
    if (roundedSwing >= 35)
        return ("Great move", "good", $"Strengthens the position by {roundedSwing} cp.");
    if (roundedSwing >= 15)
        return ("Good move", "good", $"Gains {roundedSwing} cp compared to the engine line.");

    var loss = -roundedSwing;
    if (loss <= 10)
        return ("Accurate", "accurate", "Keeps the evaluation stable.");
    if (loss <= 60)
        return ($"Inaccuracy", "inaccuracy", $"Concedes {loss} cp compared to the best move.");
    if (loss <= 150)
        return ($"Mistake", "mistake", $"Loses {loss} cp versus the engine choice.");
    return ($"Blunder", "blunder", $"Drops the evaluation by {loss} cp.");
}

static int RoundCp(double value) => (int)Math.Round(value, MidpointRounding.AwayFromZero);

app.Run();
