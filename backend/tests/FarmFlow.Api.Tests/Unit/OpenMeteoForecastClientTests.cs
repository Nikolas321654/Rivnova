using System.Net;
using System.Text;
using System.Text.Json;
using FarmFlow.Api.Infrastructure.Weather;
using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Shouldly;
using Xunit;

namespace FarmFlow.Api.Tests.Unit;

public class OpenMeteoForecastClientTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 15, 10, 25, 0, TimeSpan.Zero);

    [Fact]
    public void Summarize_SumsTheNextTwo24HourWindowsFromTheCurrentHour()
    {
        var (times, rain) = HourlySeries(hour => hour switch
        {
            < 10 => 9.9,
            < 34 => 0.25,
            < 58 => 0.5,
            _ => 9.9
        });

        var forecast = OpenMeteoForecastClient.Summarize(times, rain, Now);

        forecast.Next24hMm.ShouldBe(6.0);
        forecast.Next24To48hMm.ShouldBe(12.0);
        forecast.Source.ShouldBe(OpenMeteoForecastClient.SourceName);
        forecast.WindowStartUtc.ShouldBe(new DateTimeOffset(2026, 11, 15, 10, 0, 0, TimeSpan.Zero));
    }

    [Fact]
    public void Summarize_AddsModelledRecentRain_ForTheLast12And24Hours()
    {
        var start = new DateTimeOffset(2026, 11, 14, 0, 0, 0, TimeSpan.Zero);
        var times = Enumerable.Range(0, 96).Select(h => start.AddHours(h).ToString("yyyy-MM-dd'T'HH:mm")).ToList();
        var rain = Enumerable.Range(0, 96).Select(RecentRainAt).ToList();

        var forecast = OpenMeteoForecastClient.Summarize(times, rain, Now);

        forecast.Last12hMm.ShouldBe(6.0);
        forecast.Last24hMm.ShouldBe(9.0);
    }

    [Fact]
    public void Summarize_LeavesRecentRainUnknown_WhenPastHoursAreMissing()
    {
        var (times, rain) = HourlySeries(_ => 0.1);

        var forecast = OpenMeteoForecastClient.Summarize(times, rain, Now);

        forecast.Last12hMm.ShouldBeNull();
        forecast.Last24hMm.ShouldBeNull();
        forecast.Next24hMm.ShouldBe(2.4);
    }

    [Fact]
    public void Summarize_ReportsRealZeroRainfall_AsZero()
    {
        var (times, rain) = HourlySeries(_ => 0.0);

        var forecast = OpenMeteoForecastClient.Summarize(times, rain, Now);

        forecast.Next24hMm.ShouldBe(0.0);
        forecast.Next24To48hMm.ShouldBe(0.0);
    }

    [Fact]
    public void Summarize_Throws_WhenAnHourInsideTheWindowIsMissing()
    {
        var (times, rain) = HourlySeries(hour => hour == 40 ? null : 0.1);

        Should.Throw<InvalidDataException>(() => OpenMeteoForecastClient.Summarize(times, rain, Now));
    }

    [Fact]
    public void Summarize_Throws_WhenTheForecastDoesNotReach48Hours()
    {
        var (times, rain) = HourlySeries(_ => 0.1, hours: 50);

        Should.Throw<InvalidDataException>(() => OpenMeteoForecastClient.Summarize(times, rain, Now));
    }

    [Fact]
    public async Task GetForecastAsync_ParsesTheProviderResponse()
    {
        var handler = TestHttpMessageHandler.FromJson(HttpStatusCode.OK, BuildJson(_ => 0.1));
        var sut = CreateCachedSut(handler);

        var forecast = await sut.GetForecastAsync(49.2, 30.5, TestContext.Current.CancellationToken);

        forecast.ShouldNotBeNull();
        forecast.Next24hMm.ShouldBe(2.4);
        handler.LastRequestUri!.Query.ShouldContain("hourly=precipitation");
        handler.LastRequestUri.Query.ShouldContain("past_hours=24");
        handler.LastRequestUri.Query.ShouldContain("latitude=49.2000");
    }

    [Fact]
    public async Task GetForecastAsync_ReturnsNull_WhenTheProviderFails()
    {
        var handler = TestHttpMessageHandler.FromJson(HttpStatusCode.InternalServerError, "{}");
        var sut = CreateCachedSut(handler);

        var forecast = await sut.GetForecastAsync(49.2, 30.5, TestContext.Current.CancellationToken);

        forecast.ShouldBeNull();
    }

    [Fact]
    public async Task GetForecastAsync_ReturnsNull_WhenTheProviderTimesOut()
    {
        var handler = new TestHttpMessageHandler(async (_, ct) =>
        {
            await Task.Delay(TimeSpan.FromSeconds(5), ct);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(BuildJson(_ => 0.1), Encoding.UTF8, "application/json")
            };
        });
        var sut = CreateCachedSut(handler, timeoutSeconds: 0.5);

        var forecast = await sut.GetForecastAsync(49.2, 30.5, TestContext.Current.CancellationToken);

        forecast.ShouldBeNull();
    }

    [Fact]
    public async Task GetForecastAsync_ReturnsNull_WhenDisabled()
    {
        var handler = TestHttpMessageHandler.FromJson(HttpStatusCode.OK, BuildJson(_ => 0.1));
        var sut = CreateCachedSut(handler, enabled: false);

        (await sut.GetForecastAsync(49.2, 30.5, TestContext.Current.CancellationToken)).ShouldBeNull();
        handler.CallCount.ShouldBe(0);
    }

    [Fact]
    public async Task GetForecastAsync_CachesByRoundedCoordinatesAndHour()
    {
        var handler = TestHttpMessageHandler.FromJson(HttpStatusCode.OK, BuildJson(_ => 0.1));
        var sut = CreateCachedSut(handler);

        await sut.GetForecastAsync(49.2011, 30.5011, TestContext.Current.CancellationToken);
        await sut.GetForecastAsync(49.2049, 30.4951, TestContext.Current.CancellationToken);

        handler.CallCount.ShouldBe(1);
    }

    private static (List<string> Times, List<double?> Rain) HourlySeries(Func<int, double?> value, int hours = 72)
    {
        var start = new DateTimeOffset(2026, 11, 15, 0, 0, 0, TimeSpan.Zero);
        var times = Enumerable.Range(0, hours).Select(h => start.AddHours(h).ToString("yyyy-MM-dd'T'HH:mm")).ToList();
        var rain = Enumerable.Range(0, hours).Select(value).ToList();
        return (times, rain);
    }

    private static string BuildJson(Func<int, double?> value)
    {
        var (times, rain) = HourlySeries(value);
        return JsonSerializer.Serialize(new { hourly = new { time = times, precipitation = rain } });
    }

    private static CachedPrecipitationForecastClient CreateCachedSut(
        HttpMessageHandler handler,
        double timeoutSeconds = 3.0,
        bool enabled = true)
    {
        var settings = Options.Create(new WeatherForecastSettings
        {
            Enabled = enabled,
            TimeoutSeconds = timeoutSeconds,
            CacheMinutes = 60
        });
        var time = new FixedTimeProvider(Now);
        var client = new OpenMeteoForecastClient(new HttpClient(handler), settings, time);

        var services = new ServiceCollection();
        services.AddMemoryCache();
        services.AddHybridCache();
        var cache = services.BuildServiceProvider().GetRequiredService<HybridCache>();

        return new CachedPrecipitationForecastClient(
            client,
            cache,
            settings,
            time,
            NullLogger<CachedPrecipitationForecastClient>.Instance);
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private static double? RecentRainAt(int hour) => hour switch
    {
        >= 22 and < 34 => 0.5,
        >= 10 and < 22 => 0.25,
        _ => 0.0
    };
}
