using Arcade.Games.Blockwood.Api;
using Arcade.Games.Blockwood.Engine;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Arcade.Games.Blockwood.DI;

public static class BlockwoodServiceCollectionExtensions
{
    public static IServiceCollection AddBlockwoodGame(this IServiceCollection services)
    {
        services.AddSingleton<BlockwoodEngine>();
        return services;
    }

    public static RouteGroupBuilder MapBlockwoodFeature(this RouteGroupBuilder group, IHostEnvironment environment)
    {
        group.MapBlockwoodEndpoints();
        if (environment.IsDevelopment())
        {
            group.MapGroup("/dev").MapBlockwoodDevEndpoints();
        }

        return group;
    }
}
