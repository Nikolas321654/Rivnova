using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace FarmFlow.Api.Infrastructure.Weather;

public sealed class OpenMeteoForecastClient(
    HttpClient httpClient,
    IOptions<WeatherForecastSettings> settings,
    TimeProvider timeProvider)
{
    public const string SourceName = "OPEN_METEO_FORECAST";
    private const int WindowHours = 24;

    public async Task<PrecipitationForecast> GetForecastAsync(
        double latitude,
        double longitude,
        CancellationToken ct = default)
    {
        var lat = latitude.ToString("F4", CultureInfo.InvariantCulture);
        var lon = longitude.ToString("F4", CultureInfo.InvariantCulture);
        var url = $"{settings.Value.BaseUrl}?latitude={lat}&longitude={lon}" +
                  "&hourly=precipitation&past_hours=24&forecast_hours=49&timezone=GMT&precipitation_unit=mm";

        var payload = await httpClient.GetFromJsonAsync<OpenMeteoResponse>(url, ct)
            ?? throw new InvalidDataException("Open-Meteo returned an empty response payload.");

        var hourly = payload.Hourly
            ?? throw new InvalidDataException("Open-Meteo response is missing hourly data.");

        return Summarize(hourly.Time, hourly.Precipitation, timeProvider.GetUtcNow());
    }

    public static PrecipitationForecast Summarize(
        IReadOnlyList<string>? times,
        IReadOnlyList<double?>? precipitation,
        DateTimeOffset nowUtc)
    {
        if (times is null || precipitation is null || times.Count != precipitation.Count)
        {
            throw new InvalidDataException("Open-Meteo hourly time and precipitation arrays do not match.");
        }

        var windowStart = new DateTimeOffset(nowUtc.Year, nowUtc.Month, nowUtc.Day, nowUtc.Hour, 0, 0, TimeSpan.Zero);
        var byHour = new Dictionary<DateTimeOffset, double?>();
        for (var i = 0; i < times.Count; i++)
        {
            if (DateTime.TryParseExact(times[i], "yyyy-MM-dd'T'HH:mm", CultureInfo.InvariantCulture,
                    DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out var parsed))
            {
                byHour[new DateTimeOffset(parsed, TimeSpan.Zero)] = precipitation[i];
            }
        }

        double? TrySumRecent(int hours)
        {
            var total = 0.0;
            for (var hour = 1; hour <= hours; hour++)
            {
                if (!byHour.TryGetValue(windowStart.AddHours(-hour), out var value) ||
                    value is not { } mm || mm < 0 || !double.IsFinite(mm))
                {
                    return null;
                }

                total += mm;
            }

            return Math.Round(total, 1);
        }

        double SumWindow(int startOffsetHours)
        {
            var total = 0.0;
            for (var hour = 0; hour < WindowHours; hour++)
            {
                var key = windowStart.AddHours(startOffsetHours + hour);
                if (!byHour.TryGetValue(key, out var value) || value is not { } mm || mm < 0 || !double.IsFinite(mm))
                {
                    throw new InvalidDataException($"Open-Meteo forecast is missing precipitation for {key:O}.");
                }

                total += mm;
            }

            return Math.Round(total, 1);
        }

        return new PrecipitationForecast(
            Next24hMm: SumWindow(0),
            Next24To48hMm: SumWindow(WindowHours),
            Source: SourceName,
            WindowStartUtc: windowStart,
            Last12hMm: TrySumRecent(12),
            Last24hMm: TrySumRecent(24));
    }

    private sealed record OpenMeteoResponse([property: JsonPropertyName("hourly")] OpenMeteoHourly? Hourly);

    private sealed record OpenMeteoHourly(
        [property: JsonPropertyName("time")] List<string>? Time,
        [property: JsonPropertyName("precipitation")] List<double?>? Precipitation);
}
