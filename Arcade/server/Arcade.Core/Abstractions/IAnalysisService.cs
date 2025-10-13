namespace Arcade.Core.Abstractions;

public interface IAnalysisService<TRequest, TResponse>
{
    ValueTask<TResponse> AnalyzeAsync(TRequest request, CancellationToken cancellationToken = default);
}
