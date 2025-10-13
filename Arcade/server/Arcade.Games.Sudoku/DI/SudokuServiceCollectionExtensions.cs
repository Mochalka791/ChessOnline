using Arcade.Games.Sudoku.Api;
using Arcade.Games.Sudoku.Engine;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Arcade.Games.Sudoku.DI;

public static class SudokuServiceCollectionExtensions
{
    public static IServiceCollection AddSudokuGame(this IServiceCollection services)
    {
        services.AddSingleton<SudokuEngine>();
        return services;
    }

    public static RouteGroupBuilder MapSudokuFeature(this RouteGroupBuilder group, IHostEnvironment environment)
    {
        group.MapSudokuEndpoints();
        if (environment.IsDevelopment())
        {
            group.MapGroup("/dev").MapSudokuDevEndpoints();
        }

        return group;
    }
}
