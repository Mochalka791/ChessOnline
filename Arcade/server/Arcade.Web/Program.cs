using Arcade.Core.DI;
using Arcade.Games.Blockwood.DI;
using Arcade.Games.Chess.DI;
using Arcade.Games.Chess.Realtime;
using Arcade.Games.Minesweeper.DI;
using Arcade.Games.Snake.DI;
using Arcade.Games.Sudoku.DI;
using Arcade.Games.Tetris.DI;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddArcadeCore();
builder.Services.AddSignalR();
builder.Services.AddChessGame(builder.Configuration);
builder.Services.AddTetrisGame();
builder.Services.AddSnakeGame();
builder.Services.AddBlockwoodGame();
builder.Services.AddSudokuGame();
builder.Services.AddMinesweeperGame();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.Logger.LogInformation("Arcade startet im Entwicklungsmodus.");
}

app.UseDefaultFiles();
app.UseStaticFiles();

var api = app.MapGroup("/api");
api.MapGroup("/chess").MapChessFeature(app.Environment);
api.MapGroup("/tetris").MapTetrisFeature(app.Environment);
api.MapGroup("/snake").MapSnakeFeature(app.Environment);
api.MapGroup("/blockwood").MapBlockwoodFeature(app.Environment);
api.MapGroup("/sudoku").MapSudokuFeature(app.Environment);
api.MapGroup("/minesweeper").MapMinesweeperFeature(app.Environment);

app.MapHub<ChessHub>("/chess");

app.Run();
