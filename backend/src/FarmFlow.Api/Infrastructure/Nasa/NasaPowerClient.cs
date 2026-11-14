using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using FarmFlow.Api.Infrastructure.Nasa.NasaModels;
using Microsoft.Extensions.Options;

namespace FarmFlow.Api.Infrastructure.Nasa;

public sealed class NasaPowerClient(
    HttpClient httpClient,
    IOptions<NasaSettings> settings,
    ILogger<NasaPowerClient> logger)
    : INasaClient
{
    private const double MissingValueSentinelThreshold = -900.0;

    private const int NasaProcessingLagDays = 4;
    private const int TrailingGapBufferDays = 3;

    public async Task<FieldSatelliteSeries> GetFieldSeriesAsync(
        double latitude,
        double longitude,
        string? demoScenario = null,
        int days = 14,
        CancellationToken ct = default)
    {
        var clampedDays = Math.Clamp(days, 7, 30);
        var endDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-NasaProcessingLagDays));
        var startDate = endDate.AddDays(-(clampedDays - 1 + TrailingGapBufferDays));

        var requestUrl = BuildRequestUrl(settings.Value.PowerApiBaseUrl, latitude, longitude, startDate, endDate);
        logger.LogInformation("Fetching live NASA POWER daily series for ({Lat}, {Lon}) from {Start} to {End}.",
            latitude, longitude, startDate, endDate);

        var payload = await httpClient.GetFromJsonAsync<NasaPowerApiResponse>(requestUrl, ct)
            ?? throw new InvalidDataException("NASA POWER API returned an empty response payload.");

        var parameters = payload.Properties?.Parameter
            ?? throw new InvalidDataException("NASA POWER response is missing properties.parameter.");

        var dailyMetrics = ParseWithIsolatedGaps(parameters);
        if (dailyMetrics.Count == 0)
        {
            throw new InvalidDataException("NASA POWER response contained no daily records.");
        }

        if (dailyMetrics.Count > clampedDays)
        {
            dailyMetrics = dailyMetrics.TakeLast(clampedDays).ToList();
        }

        return new FieldSatelliteSeries(
            DailySeries: dailyMetrics,
            RainLast12hMm: null,
            RainLast24hMm: null,
            RainForecast24hMm: null,
            RainForecast48hMm: null,
            DataSource: "NASA_POWER_LIVE");
    }

    public async Task<IReadOnlyList<NasaDailyMetric>> GetHistoryAsync(
        double latitude, double longitude, DateOnly from, DateOnly to, CancellationToken ct = default)
    {
        var url = BuildRequestUrl(settings.Value.PowerApiBaseUrl, latitude, longitude, from, to);
        var payload = await httpClient.GetFromJsonAsync<NasaPowerApiResponse>(url, ct)
            ?? throw new InvalidDataException("NASA POWER returned an empty payload.");
        var parameters = payload.Properties?.Parameter
            ?? throw new InvalidDataException("NASA POWER parameters are unavailable.");
        return ParseDailyMetrics(parameters, true).Where(day => day.Date >= from && day.Date <= to).ToList();
    }

    private static string BuildRequestUrl(
        string baseUrl,
        double latitude,
        double longitude,
        DateOnly startDate,
        DateOnly endDate)
    {
        var lat = latitude.ToString("F4", CultureInfo.InvariantCulture);
        var lon = longitude.ToString("F4", CultureInfo.InvariantCulture);
        var start = startDate.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
        var end = endDate.ToString("yyyyMMdd", CultureInfo.InvariantCulture);

        return $"{baseUrl}?parameters=PRECTOTCORR,GWETTOP,GWETROOT,ALLSKY_SFC_SW_DWN" +
               $"&community=AG&longitude={lon}&latitude={lat}&start={start}&end={end}&format=JSON";
    }

    private const int MinCompleteDaysWithGaps = 7;

    private static List<NasaDailyMetric> ParseWithIsolatedGaps(NasaPowerParameters parameters)
    {
        try
        {
            return ParseDailyMetrics(parameters);
        }
        catch (InvalidDataException)
        {
            var withoutGaps = ParseDailyMetrics(parameters, allowGaps: true);
            if (withoutGaps.Count < MinCompleteDaysWithGaps)
            {
                throw;
            }

            return withoutGaps;
        }
    }

    private static List<NasaDailyMetric> ParseDailyMetrics(NasaPowerParameters parameters, bool allowGaps = false)
    {
        if (parameters.Precipitation is null ||
            parameters.SurfaceMoisture is null ||
            parameters.RootzoneMoisture is null ||
            parameters.SolarRadiation is null)
        {
            throw new InvalidDataException("NASA POWER response is missing one or more required agro parameters.");
        }

        var observations = new List<(DateOnly Date, string Key, double[] Values)>(parameters.Precipitation.Count);

        foreach (var dateKey in parameters.Precipitation.Keys.OrderBy(k => k, StringComparer.Ordinal))
        {
            if (!DateOnly.TryParseExact(dateKey, "yyyyMMdd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            {
                continue;
            }

            observations.Add((date, dateKey,
            [
                ValueOrNaN(parameters.Precipitation, dateKey),
                ValueOrNaN(parameters.SurfaceMoisture, dateKey),
                ValueOrNaN(parameters.RootzoneMoisture, dateKey),
                ValueOrNaN(parameters.SolarRadiation, dateKey)
            ]));
        }

        var lastComplete = observations.FindLastIndex(o => IsComplete(o.Values));
        if (lastComplete < 0)
        {
            return [];
        }

        var metrics = new List<NasaDailyMetric>(lastComplete + 1);

        for (var index = 0; index <= lastComplete; index++)
        {
            var (date, dateKey, values) = observations[index];
            if (!IsComplete(values))
            {
                if (allowGaps) continue;
                throw new InvalidDataException(
                    $"NASA POWER returned missing or invalid observation for {dateKey}.");
            }

            var (precipitation, surfaceMoisture, rootzoneMoisture, solarRadiation) =
                (values[0], values[1], values[2], values[3]);

            var clampedSurface = Math.Clamp(surfaceMoisture, 0.0, 1.0);
            var clampedRootzone = Math.Clamp(rootzoneMoisture, 0.0, 1.0);
            var clampedPrecipitation = Math.Max(0.0, precipitation);
            var clampedSolar = Math.Max(0.0, solarRadiation);

            metrics.Add(new NasaDailyMetric(
                Date: date,
                PrecipitationMm: Math.Round(clampedPrecipitation, 2),
                SurfaceMoisture: Math.Round(clampedSurface, 3),
                RootzoneMoisture: Math.Round(clampedRootzone, 3),
                SolarRadiation: Math.Round(clampedSolar, 2),
                Ndvi: DeriveSeasonalNdvi(date, clampedRootzone),
                Esi: DeriveEvaporativeStressIndex(clampedRootzone, clampedSolar)));
        }

        return metrics;
    }

    private static double ValueOrNaN(IReadOnlyDictionary<string, double> series, string dateKey) =>
        series.TryGetValue(dateKey, out var value) ? value : double.NaN;

    private static bool IsComplete(double[] values) =>
        !Array.Exists(values, v => double.IsNaN(v) || double.IsInfinity(v) || v <= MissingValueSentinelThreshold);

    private static double DeriveSeasonalNdvi(DateOnly date, double rootzoneMoisture)
    {
        var dayAngle = 2.0 * Math.PI * (date.DayOfYear - 195) / 365.0;
        var seasonalCurve = 0.5 + 0.5 * Math.Cos(dayAngle);
        return Math.Round(Math.Clamp(0.28 + 0.36 * seasonalCurve + 0.22 * rootzoneMoisture, 0.15, 0.90), 3);
    }

    private static double DeriveEvaporativeStressIndex(double rootzoneMoisture, double solarRadiation)
    {
        var heatPenalty = Math.Max(0.0, solarRadiation - 18.0) * 0.015;
        return Math.Round(Math.Clamp(0.25 + 0.70 * rootzoneMoisture - heatPenalty, 0.10, 0.95), 3);
    }

    private sealed record NasaPowerApiResponse(
        [property: JsonPropertyName("properties")] NasaPowerProperties? Properties);

    private sealed record NasaPowerProperties(
        [property: JsonPropertyName("parameter")] NasaPowerParameters? Parameter);

    private sealed record NasaPowerParameters(
        [property: JsonPropertyName("PRECTOTCORR")] Dictionary<string, double>? Precipitation,
        [property: JsonPropertyName("GWETTOP")] Dictionary<string, double>? SurfaceMoisture,
        [property: JsonPropertyName("GWETROOT")] Dictionary<string, double>? RootzoneMoisture,
        [property: JsonPropertyName("ALLSKY_SFC_SW_DWN")] Dictionary<string, double>? SolarRadiation);
}
