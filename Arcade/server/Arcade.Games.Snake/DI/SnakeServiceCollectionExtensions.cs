using Arcade.Games.Snake.Api;
using Arcade.Games.Snake.Engine;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Arcade.Games.Snake.DI;

public static class SnakeServiceCollectionExtensions
{
    public static IServiceCollection AddSnakeGame(this IServiceCollection services)
    {
        services.AddSingleton<SnakeEngine>();
        return services;
    }

    public static RouteGroupBuilder MapSnakeFeature(this RouteGroupBuilder group, IHostEnvironment environment)
    {
        group.MapSnakeEndpoints();
        if (environment.IsDevelopment())
        {
            group.MapGroup("/dev").MapSnakeDevEndpoints();
        }

        return group;
    }
}
