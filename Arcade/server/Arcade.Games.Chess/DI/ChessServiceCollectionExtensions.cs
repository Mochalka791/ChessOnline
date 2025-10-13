using Arcade.Games.Chess.Api;
using Arcade.Games.Chess.Domain;
using Arcade.Games.Chess.Engine;
using Arcade.Games.Chess.Rules;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Arcade.Games.Chess.DI;

public static class ChessServiceCollectionExtensions
{
    public static IServiceCollection AddChessGame(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<ChessOptions>(configuration.GetSection("Chess"));
        services.AddSingleton<MoveValidator>();
        services.AddSingleton<ChessGameManager>();
        services.AddSingleton<StockfishEngine>();
        services.AddSingleton<AnalysisService>();
        return services;
    }

    public static RouteGroupBuilder MapChessFeature(this RouteGroupBuilder group, IHostEnvironment environment)
    {
        group.MapChessEndpoints();
        group.MapAnalyzeEndpoints();

        if (environment.IsDevelopment())
        {
            group.MapGroup("/dev").MapDevChessEndpoints();
        }

        return group;
    }
}
