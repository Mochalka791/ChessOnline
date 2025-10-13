using Microsoft.Extensions.DependencyInjection;

namespace Arcade.Core.DI;

public static class CoreServiceCollectionExtensions
{
    public static IServiceCollection AddArcadeCore(this IServiceCollection services)
    {
        return services;
    }
}
