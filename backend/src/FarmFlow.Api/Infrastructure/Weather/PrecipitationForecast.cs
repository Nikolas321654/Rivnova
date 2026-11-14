namespace FarmFlow.Api.Infrastructure.Weather;

public sealed record PrecipitationForecast(
    double Next24hMm,
    double Next24To48hMm,
    string Source,
    DateTimeOffset WindowStartUtc,
    double? Last12hMm = null,
    double? Last24hMm = null);
