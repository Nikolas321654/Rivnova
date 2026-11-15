using System.Globalization;
using System.Text.Json;
using FarmFlow.Api.Infrastructure.Nasa.NasaModels;
using FarmFlow.Api.Infrastructure.Weather;
using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.Options;

namespace FarmFlow.Api.Infrastructure.Nasa;

public sealed class ResilientNasaClient(
    NasaPowerClient powerClient,
    MockNasaClient mockClient,
    IPrecipitationForecastClient forecastClient,
    HybridCache cache,
    IOptions<NasaSettings> settings,
    ILogger<ResilientNasaClient> logger)
    : INasaClient
{
    public async Task<FieldSatelliteSeries> GetFieldSeriesAsync(
        double latitude,
        double longitude,
        string? demoScenario = null,
        int days = 14,
        CancellationToken ct = default)
    {
        var currentSettings = settings.Value;
        if (currentSettings.ForceMock || !string.IsNullOrWhiteSpace(demoScenario))
        {
            return await mockClient.GetFieldSeriesAsync(latitude, longitude, demoScenario, days, ct);
        }

        var roundedLat = Math.Round(latitude, 2);
        var roundedLon = Math.Round(longitude, 2);
        var clampedDays = Math.Clamp(days, 7, 30);
        var cacheKey = string.Create(
            CultureInfo.InvariantCulture,
            $"nasa:series:{roundedLat:F2}:{roundedLon:F2}:{clampedDays}");

        var cacheDuration = TimeSpan.FromHours(Math.Max(1, currentSettings.CacheDurationHours));
        var entryOptions = new HybridCacheEntryOptions
        {
            Expiration = cacheDuration,
            LocalCacheExpiration = cacheDuration
        };

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(Math.Max(0.5, currentSettings.TimeoutSeconds)));

        var forecastTask = forecastClient.GetForecastAsync(roundedLat, roundedLon, ct);

        FieldSatelliteSeries observed;
        try
        {
            observed = await cache.GetOrCreateAsync(
                cacheKey,
                async token => await powerClient.GetFieldSeriesAsync(roundedLat, roundedLon, null, clampedDays, token),
                entryOptions,
                cancellationToken: timeoutCts.Token);
        }
        catch (Exception ex) when (IsFallbackEligible(ex, ct))
        {
            logger.LogWarning(
                ex,
                "NASA POWER lookup failed for ({Lat}, {Lon}); falling back to deterministic fixtures.",
                roundedLat,
                roundedLon);

            var simulated = await mockClient.GetFieldSeriesAsync(roundedLat, roundedLon, null, clampedDays, ct);
            var liveForecast = await forecastTask;
            return liveForecast is null
                ? simulated
                : simulated with
                {
                    RainForecast24hMm = liveForecast.Next24hMm,
                    RainForecast48hMm = liveForecast.Next24To48hMm,
                    ForecastSource = liveForecast.Source
                };
        }

        var forecast = await forecastTask;
        var useProviderRecentRain = observed.RainLast12hMm is null && forecast?.Last12hMm is not null &&
                                    forecast.Last24hMm is not null;
        var observedRecentRainSource = observed.RainLast12hMm is null ? null : observed.DataSource;
        return observed with
        {
            RainForecast24hMm = forecast?.Next24hMm,
            RainForecast48hMm = forecast?.Next24To48hMm,
            ForecastSource = forecast?.Source,
            RainLast12hMm = useProviderRecentRain ? forecast!.Last12hMm : observed.RainLast12hMm,
            RainLast24hMm = useProviderRecentRain ? forecast!.Last24hMm : observed.RainLast24hMm,
            RecentRainSource = useProviderRecentRain ? forecast!.Source : observedRecentRainSource
        };
    }

    private static bool IsFallbackEligible(Exception ex, CancellationToken callerCt) =>
        ex is HttpRequestException or InvalidDataException or JsonException ||
        (ex is OperationCanceledException && !callerCt.IsCancellationRequested);
}
