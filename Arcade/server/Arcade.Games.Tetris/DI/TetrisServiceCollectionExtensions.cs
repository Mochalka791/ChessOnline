using Arcade.Games.Tetris.Api;
using Arcade.Games.Tetris.Engine;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Arcade.Games.Tetris.DI;

public static class TetrisServiceCollectionExtensions
{
    public static IServiceCollection AddTetrisGame(this IServiceCollection services)
    {
        services.AddSingleton<TetrisEngine>();
        return services;
    }

    public static RouteGroupBuilder MapTetrisFeature(this RouteGroupBuilder group, IHostEnvironment environment)
    {
        group.MapTetrisEndpoints();
        if (environment.IsDevelopment())
        {
            group.MapGroup("/dev").MapTetrisDevEndpoints();
        }

        return group;
    }
}
