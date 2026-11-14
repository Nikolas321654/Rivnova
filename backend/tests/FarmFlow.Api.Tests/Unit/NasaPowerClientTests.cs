using System.Net;
using FarmFlow.Api.Infrastructure.Nasa;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Shouldly;
using Xunit;

namespace FarmFlow.Api.Tests.Unit;

public class NasaPowerClientTests
{
    [Fact]
    public async Task GetFieldSeriesAsync_ParsesValidPayload_AndIncludesAllRequiredQueryParameters()
    {
        var json = BuildSamplePowerJson(rootzoneDay2: 0.43);
        var handler = TestHttpMessageHandler.FromJson(HttpStatusCode.OK, json);
        var client = CreateClient(handler);

        var series = await client.GetFieldSeriesAsync(48.45, 31.18, days: 14, ct: TestContext.Current.CancellationToken);

        series.DataSource.ShouldBe("NASA_POWER_LIVE");
        series.DailySeries.Count.ShouldBe(2);
        series.DailySeries[^1].RootzoneMoisture.ShouldBe(0.43);
        series.DailySeries[^1].Ndvi.ShouldBeInRange(0.15, 0.90);
        series.DailySeries[^1].Esi.ShouldBeInRange(0.10, 0.95);

        handler.LastRequestUri.ShouldNotBeNull();
        var query = handler.LastRequestUri.Query;
        query.ShouldContain("parameters=PRECTOTCORR,GWETTOP,GWETROOT,ALLSKY_SFC_SW_DWN");
        query.ShouldContain("community=AG");
        query.ShouldContain("latitude=48.4500");
        query.ShouldContain("longitude=31.1800");
        query.ShouldContain("start=");
        query.ShouldContain("end=");
    }

    [Fact]
    public async Task GetFieldSeriesAsync_ThrowsInvalidDataException_WhenMissingSentinelIsInsideTheSeries()
    {
        var json = BuildThreeDayPowerJson(rootzoneDay2: -999.0, solarDay3: 15.4);
        var handler = TestHttpMessageHandler.FromJson(HttpStatusCode.OK, json);
        var client = CreateClient(handler);

        await Should.ThrowAsync<InvalidDataException>(async () =>
            await client.GetFieldSeriesAsync(48.45, 31.18, ct: TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task GetFieldSeriesAsync_SkipsAnIsolatedIncompleteDay_WhenEnoughDaysRemain()
    {
        var days = Enumerable.Range(1, 10).Select(d => $"202610{d:00}").ToList();
        string Series(Func<string, double> value) =>
            "{" + string.Join(",", days.Select(d => $"\"{d}\": {value(d).ToString(System.Globalization.CultureInfo.InvariantCulture)}")) + "}";
        var json = "{\"properties\":{\"parameter\":{" +
                   $"\"PRECTOTCORR\":{Series(_ => 0.5)}," +
                   $"\"GWETTOP\":{Series(_ => 0.3)}," +
                   $"\"GWETROOT\":{Series(_ => 0.4)}," +
                   $"\"ALLSKY_SFC_SW_DWN\":{Series(d => d == "20261004" ? -999.0 : 14.0)}" +
                   "}}}";
        var client = CreateClient(TestHttpMessageHandler.FromJson(HttpStatusCode.OK, json));

        var result = await client.GetFieldSeriesAsync(48.45, 31.18, ct: TestContext.Current.CancellationToken);

        result.DataSource.ShouldBe("NASA_POWER_LIVE");
        result.DailySeries.Count.ShouldBe(9);
        result.DailySeries.ShouldNotContain(m => m.Date == new DateOnly(2026, 10, 4));
    }

    [Fact]
    public async Task GetFieldSeriesAsync_DropsTrailingDaysThatAreNotPublishedYet()
    {
        var json = BuildThreeDayPowerJson(rootzoneDay2: 0.43, solarDay3: -999.0);
        var handler = TestHttpMessageHandler.FromJson(HttpStatusCode.OK, json);
        var client = CreateClient(handler);

        var series = await client.GetFieldSeriesAsync(48.45, 31.18, ct: TestContext.Current.CancellationToken);

        series.DataSource.ShouldBe("NASA_POWER_LIVE");
        series.DailySeries.Count.ShouldBe(2);
        series.DailySeries[^1].Date.ShouldBe(new DateOnly(2026, 11, 2));
        series.DailySeries[^1].RootzoneMoisture.ShouldBe(0.43);
    }

    [Fact]
    public async Task GetFieldSeriesAsync_ThrowsInvalidDataException_WhenNoDayIsComplete()
    {
        var json = BuildSamplePowerJson(rootzoneDay2: -999.0).Replace("\"20261101\": 0.42", "\"20261101\": -999.0");
        var handler = TestHttpMessageHandler.FromJson(HttpStatusCode.OK, json);
        var client = CreateClient(handler);

        await Should.ThrowAsync<InvalidDataException>(async () =>
            await client.GetFieldSeriesAsync(48.45, 31.18, ct: TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task GetFieldSeriesAsync_RequestsBufferDays_AndReturnsAtMostTheRequestedDays()
    {
        var days = Enumerable.Range(0, 10).Select(i => new DateOnly(2026, 11, 1).AddDays(i).ToString("yyyyMMdd")).ToArray();
        string Series(double value) => "{ " + string.Join(", ", days.Select(d => $"\"{d}\": {value.ToString(System.Globalization.CultureInfo.InvariantCulture)}")) + " }";
        var json = $$"""
          { "properties": { "parameter": {
            "PRECTOTCORR": {{Series(0.5)}}, "GWETTOP": {{Series(0.3)}},
            "GWETROOT": {{Series(0.4)}}, "ALLSKY_SFC_SW_DWN": {{Series(14.0)}} } } }
          """;
        var handler = TestHttpMessageHandler.FromJson(HttpStatusCode.OK, json);
        var client = CreateClient(handler);

        var series = await client.GetFieldSeriesAsync(48.45, 31.18, days: 7, ct: TestContext.Current.CancellationToken);

        series.DailySeries.Count.ShouldBe(7);
        series.DailySeries[0].Date.ShouldBe(new DateOnly(2026, 11, 4));
        var query = handler.LastRequestUri!.Query;
        var start = DateOnly.ParseExact(System.Web.HttpUtility.ParseQueryString(query)["start"]!, "yyyyMMdd", System.Globalization.CultureInfo.InvariantCulture);
        var end = DateOnly.ParseExact(System.Web.HttpUtility.ParseQueryString(query)["end"]!, "yyyyMMdd", System.Globalization.CultureInfo.InvariantCulture);
        (end.DayNumber - start.DayNumber + 1).ShouldBe(10);
    }

    [Fact]
    public async Task History_PreservesRangeBeyondThirtyDays_AndSkipsMissingObservations()
    {
        var handler = TestHttpMessageHandler.FromJson(HttpStatusCode.OK, BuildThreeDayPowerJson(-999, -999));
        var client = CreateClient(handler);
        var result = await client.GetHistoryAsync(48, 31, new DateOnly(2026, 5, 1), new DateOnly(2026, 11, 15), TestContext.Current.CancellationToken);
        result.Count.ShouldBe(1);
        result[0].Date.ShouldBe(new DateOnly(2026, 11, 1));
        handler.LastRequestUri!.Query.ShouldContain("start=20260501");
        handler.LastRequestUri.Query.ShouldContain("end=20261115");
    }

    [Fact]
    public async Task History_ReturnsEntireSeasonWithoutThirtyDayClamp()
    {
        var start = new DateOnly(2026, 5, 1);
        var dates = Enumerable.Range(0, 180).Select(i => start.AddDays(i).ToString("yyyyMMdd", System.Globalization.CultureInfo.InvariantCulture)).ToArray();
        var values = dates.ToDictionary(day => day, _ => 0.4);
        var json = System.Text.Json.JsonSerializer.Serialize(new
        {
            properties = new
            {
                parameter = new Dictionary<string, object>
                {
                    ["PRECTOTCORR"] = values,
                    ["GWETTOP"] = values,
                    ["GWETROOT"] = values,
                    ["ALLSKY_SFC_SW_DWN"] = values
                }
            }
        });
        var client = CreateClient(TestHttpMessageHandler.FromJson(HttpStatusCode.OK, json));
        var result = await client.GetHistoryAsync(48, 31, start, start.AddDays(179), TestContext.Current.CancellationToken);
        result.Count.ShouldBe(180);
        result[0].Date.ShouldBe(start);
        result[^1].Date.ShouldBe(start.AddDays(179));
    }

    private static NasaPowerClient CreateClient(HttpMessageHandler handler)
    {
        var httpClient = new HttpClient(handler);
        var options = Options.Create(new NasaSettings());
        return new NasaPowerClient(httpClient, options, NullLogger<NasaPowerClient>.Instance);
    }

    internal static string BuildSamplePowerJson(double rootzoneDay2) =>
        $$"""
          {
            "properties": {
              "parameter": {
                "PRECTOTCORR": { "20261101": 0.0, "20261102": 1.2 },
                "GWETTOP": { "20261101": 0.25, "20261102": 0.28 },
                "GWETROOT": { "20261101": 0.42, "20261102": {{rootzoneDay2.ToString(System.Globalization.CultureInfo.InvariantCulture)}} },
                "ALLSKY_SFC_SW_DWN": { "20261101": 14.5, "20261102": 15.1 }
              }
            }
          }
          """;

    internal static string BuildThreeDayPowerJson(double rootzoneDay2, double solarDay3)
    {
        static string Value(double value) => value.ToString(System.Globalization.CultureInfo.InvariantCulture);
        return $$"""
          {
            "properties": {
              "parameter": {
                "PRECTOTCORR": { "20261101": 0.0, "20261102": 1.2, "20261103": 0.4 },
                "GWETTOP": { "20261101": 0.25, "20261102": 0.28, "20261103": 0.27 },
                "GWETROOT": { "20261101": 0.42, "20261102": {{Value(rootzoneDay2)}}, "20261103": 0.41 },
                "ALLSKY_SFC_SW_DWN": { "20261101": 14.5, "20261102": 15.1, "20261103": {{Value(solarDay3)}} }
              }
            }
          }
          """;
    }
}
