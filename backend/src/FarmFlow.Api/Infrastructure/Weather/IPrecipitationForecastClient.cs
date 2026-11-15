namespace FarmFlow.Api.Infrastructure.Weather;

public interface IPrecipitationForecastClient
{
    Task<PrecipitationForecast?> GetForecastAsync(double latitude, double longitude, CancellationToken ct = default);
}
