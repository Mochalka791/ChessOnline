using ChessOnline;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Threading;

var builder = WebApplication.CreateBuilder(args);

// Services
builder.Services.AddSignalR();
builder.Services.AddSingleton<IGameStore, InMemoryGameStore>();
builder.Services.AddHttpClient();
builder.Services.AddSingleton<StockfishEngine>(); // lokaler Stockfish

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

// SignalR-Hub
app.MapHub<ChessHub>("/chess");

// ===== LOKALER ANALYSE-ENDPOINT (Stockfish) =====
// GET /api/local/analyze?roomId=testroom&depth=14
app.MapGet("/api/local/analyze", async (
    IGameStore store,
    StockfishEngine engine,
    string roomId,
    int? depth,
    CancellationToken cancellationToken) =>
{
    try
    {
        if (string.IsNullOrWhiteSpace(roomId))
            return Results.Json(new { ok = false, error = "roomId fehlt." }, statusCode: StatusCodes.Status400BadRequest);

        var targetDepth = depth is > 4 and <= 30 ? depth.Value : 14;

        var game = store.GetOrCreate(roomId);

        if (!game.TryGetLastMoveAnalysisContext(out var ctx))
        {
            var eval = await engine.AnalyzeAsync(game.ExportUciMoveList(), targetDepth, cancellationToken);

            return Results.Json(new { ok = true, depth = eval.Depth, summary = new
            {
                mover = "none",
                moveSan = "(keine Züge)",
                evaluationBefore = FormatEvalDisplay(eval, invertPerspective: false),
                evaluationAfter = FormatEvalDisplay(eval, invertPerspective: false),
                cpBefore = RoundCp(NormalizeEval(eval, invertPerspective: false)),
                cpAfter = RoundCp(NormalizeEval(eval, invertPerspective: false)),
                swing = 0,
                judgement = "Überblick",
                severity = "info",
                comment = "Die Partie hat noch nicht begonnen. Spiele einen Zug, um Feedback zu erhalten.",
                bestSan = string.Empty,
                pvSan = Array.Empty<string>()
            }
            });
        }

        var beforeEval = await engine.AnalyzeAsync(ctx.UciBefore, targetDepth, cancellationToken);
        var afterEval = await engine.AnalyzeAsync(ctx.UciAfter, targetDepth, cancellationToken);

        var cpBefore = NormalizeEval(beforeEval, invertPerspective: false);
        var cpAfter = NormalizeEval(afterEval, invertPerspective: true);
        var swing = cpAfter - cpBefore;

        var (label, severity, comment) = ClassifyMove(swing, afterEval);
        var mover = ctx.Mover == PieceColor.White ? "Weiß" : "Schwarz";

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
            _ => "Lokale Analyse konnte nicht gestartet werden. Bitte Stockfish-Installation prüfen."
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
    if (after.ScoreType == "mate")
    {
        if (after.Score > 0)
            return ("Patzer", "blunder", $"Erlaubt Matt in {after.Score}.");
        if (after.Score < 0)
            return ("Gewinnzug", "brilliant", $"Erzwingt Matt in {Math.Abs(after.Score)}.");
    }

    var roundedSwing = RoundCp(swing);
    if (roundedSwing >= 80)
        return ("Brillant", "brilliant", $"Verbessert die Stellung um {roundedSwing} Wertungspunkte.");
    if (roundedSwing >= 35)
        return ("Starker Zug", "good", $"Festigt die Stellung um {roundedSwing} Punkte.");
    if (roundedSwing >= 15)
        return ("Guter Zug", "good", $"Gewinnt {roundedSwing} Punkte gegenüber der Engine-Variante.");

    var loss = -roundedSwing;
    if (loss <= 10)
        return ("Präzise", "accurate", "Hält die Bewertung stabil.");
    if (loss <= 60)
        return ($"Ungenau", "inaccuracy", $"Gibt {loss} Punkte gegenüber dem besten Zug ab.");
    if (loss <= 150)
        return ($"Fehler", "mistake", $"Verliert {loss} Punkte im Vergleich zur Engine.");
    return ($"Patzer", "blunder", $"Verschlechtert die Stellung um {loss} Punkte.");
}

static int RoundCp(double value) => (int)Math.Round(value, MidpointRounding.AwayFromZero);

app.Run();
