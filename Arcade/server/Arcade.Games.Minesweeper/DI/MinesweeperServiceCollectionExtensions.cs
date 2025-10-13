using Arcade.Games.Minesweeper.Api;
using Arcade.Games.Minesweeper.Engine;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Arcade.Games.Minesweeper.DI;

public static class MinesweeperServiceCollectionExtensions
{
    public static IServiceCollection AddMinesweeperGame(this IServiceCollection services)
    {
        services.AddSingleton<MinesweeperEngine>();
        return services;
    }

    public static RouteGroupBuilder MapMinesweeperFeature(this RouteGroupBuilder group, IHostEnvironment environment)
    {
        group.MapMinesweeperEndpoints();
        if (environment.IsDevelopment())
        {
            group.MapGroup("/dev").MapMinesweeperDevEndpoints();
        }

        return group;
    }
}
