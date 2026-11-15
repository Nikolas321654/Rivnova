using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.Options;

namespace FarmFlow.Api.Infrastructure.Weather;

public sealed class CachedPrecipitationForecastClient(
    OpenMeteoForecastClient forecastClient,
    HybridCache cache,
    IOptions<WeatherForecastSettings> settings,
    TimeProvider timeProvider,
    ILogger<CachedPrecipitationForecastClient> logger)
    : IPrecipitationForecastClient
{
    public async Task<PrecipitationForecast?> GetForecastAsync(
        double latitude,
        double longitude,
        CancellationToken ct = default)
    {
        var currentSettings = settings.Value;
        if (!currentSettings.Enabled)
        {
            return null;
        }

        var roundedLat = Math.Round(latitude, 2);
        var roundedLon = Math.Round(longitude, 2);
        var hourBucket = timeProvider.GetUtcNow().ToString("yyyyMMddHH", CultureInfo.InvariantCulture);
        var cacheKey = string.Create(
            CultureInfo.InvariantCulture,
            $"weather:precip:{roundedLat:F2}:{roundedLon:F2}:{hourBucket}");

        var cacheDuration = TimeSpan.FromMinutes(Math.Clamp(currentSettings.CacheMinutes, 1, 60));
        var entryOptions = new HybridCacheEntryOptions
        {
            Expiration = cacheDuration,
            LocalCacheExpiration = cacheDuration
        };

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(Math.Max(0.5, currentSettings.TimeoutSeconds)));

        try
        {
            return await cache.GetOrCreateAsync(
                cacheKey,
                async token => await forecastClient.GetForecastAsync(roundedLat, roundedLon, token),
                entryOptions,
                cancellationToken: timeoutCts.Token);
        }
        catch (Exception ex) when (IsUnavailable(ex, ct))
        {
            logger.LogWarning(
                ex,
                "Precipitation forecast lookup failed for ({Lat}, {Lon}); reporting the forecast as unavailable.",
                roundedLat,
                roundedLon);
            return null;
        }
    }

    private static bool IsUnavailable(Exception ex, CancellationToken callerCt) =>
        ex is HttpRequestException or InvalidDataException or JsonException ||
        (ex is OperationCanceledException && !callerCt.IsCancellationRequested);
}
