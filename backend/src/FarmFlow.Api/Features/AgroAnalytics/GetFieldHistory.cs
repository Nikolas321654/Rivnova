using System.Globalization;
using System.Security.Claims;
using System.Text.Json;
using FarmFlow.Api.Infrastructure.Auth;
using FarmFlow.Api.Infrastructure.Database;
using FarmFlow.Api.Infrastructure.Nasa;
using FarmFlow.Api.Infrastructure.Nasa.NasaModels;
using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.Options;

namespace FarmFlow.Api.Features.AgroAnalytics;

public static class GetFieldHistory
{
    public record Response(Guid FieldId, DateOnly From, DateOnly To, string DataSource,
        DateOnly? LatestObservationDate, IReadOnlyList<NasaDailyMetric> TimeSeries);

    public static void MapEndpoint(IEndpointRouteBuilder app) =>
        app.MapGet("/api/fields/{id:guid}/history", Handle).WithTags("AgroAnalytics");

    public static bool ValidRange(string? from, string? to, DateOnly today, out DateOnly start, out DateOnly end)
    {
        var validStart = DateOnly.TryParseExact(from, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out start);
        var validEnd = DateOnly.TryParseExact(to, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out end);
        return validStart && validEnd && start <= end && end <= today && start >= today.AddDays(-365);
    }

    public static async Task<IResult> Handle(Guid id, string? from, string? to,
        ClaimsPrincipal principal, AppDbContext db, NasaPowerClient powerClient, MockNasaClient mockClient,
        HybridCache cache, IOptions<NasaSettings> settings, CancellationToken ct)
    {
        var field = await db.GetAccessibleFieldAsync(id, principal, ct);
        if (field is null) return Results.NotFound();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (!ValidRange(from, to, today, out var start, out var end))
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["range"] = ["Use YYYY-MM-DD dates with from <= to, within the last 366 calendar days and not in the future."]
            });

        var simulated = field.IsDemo || settings.Value.ForceMock;
        IReadOnlyList<NasaDailyMetric> observations;
        if (simulated)
        {
            var fixture = await mockClient.GetFieldSeriesAsync(field.Centroid.Y, field.Centroid.X, field.DemoScenario, 30, ct);
            observations = fixture.DailySeries.Where(day => day.Date >= start && day.Date <= end).ToList();
        }
        else
        {
            var lat = Math.Round(field.Centroid.Y, 2);
            var lon = Math.Round(field.Centroid.X, 2);
            var key = string.Create(CultureInfo.InvariantCulture, $"nasa:history:{lat:F2}:{lon:F2}:{start:yyyyMMdd}:{end:yyyyMMdd}");
            var duration = end < today.AddDays(-7) ? TimeSpan.FromDays(7) : TimeSpan.FromHours(6);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(Math.Max(10, settings.Value.TimeoutSeconds)));
            try
            {
                observations = await cache.GetOrCreateAsync(key,
                    async token => await powerClient.GetHistoryAsync(lat, lon, start, end, token),
                    new HybridCacheEntryOptions { Expiration = duration, LocalCacheExpiration = duration },
                    cancellationToken: timeout.Token);
            }
            catch (Exception ex) when (ex is HttpRequestException or InvalidDataException or JsonException ||
                (ex is OperationCanceledException && !ct.IsCancellationRequested))
            {
                return Results.Problem(statusCode: 503, title: "Historical NASA observations are unavailable.");
            }
        }
        return Results.Ok(new Response(id, start, end, simulated ? "MOCK_FIXTURE" : "NASA_POWER_LIVE",
            observations.Count == 0 ? null : observations[^1].Date, observations));
    }
}
