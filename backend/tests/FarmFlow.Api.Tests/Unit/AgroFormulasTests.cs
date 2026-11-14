using System.Globalization;
using FarmFlow.Api.Features.AgroAnalytics;
using FarmFlow.Api.Infrastructure.Database.Entities;
using FarmFlow.Api.Infrastructure.Nasa.NasaModels;
using Shouldly;
using Xunit;

namespace FarmFlow.Api.Tests.Unit;

public class AgroFormulasTests
{
    [Theory]
    [InlineData(null)]
    [InlineData(0.0)]
    [InlineData(8.0)]
    public void MissingRecentRain_DoesNotConfirmSafety(double? forecast)
    {
        var series = CreateSeries(0, 0, 0, 0, 0.25, 0.42, 0.74, 0.68) with
        {
            RainLast12hMm = null,
            RainLast24hMm = null,
            RainForecast24hMm = forecast
        };
        var result = AgroFormulas.EvaluateWorkability(series);
        result.Status.ShouldBe("Unknown");
        result.SprayingSafe.ShouldBe(forecast >= 5 ? false : null);
        result.Forecast48h[1].Status.ShouldBe("Unknown");
    }

    [Fact]
    public void MissingRecentRain_WithAvailableForecast_ExplainsUnknownWithoutClaimingForecastMissing()
    {
        var series = CreateSeries(0, 0, 0, 9.5, 0.45, 0.42, 0.74, 0.68) with
        {
            RainLast12hMm = null,
            RainLast24hMm = null
        };
        var result = AgroFormulas.EvaluateWorkability(series);
        result.SprayingSafe.ShouldBeNull();
        result.Forecast48h[1].Status.ShouldBe("Unknown");
        result.Forecast48h[1].Reason.ShouldStartWith("0.0 mm precipitation forecast");
        result.Forecast48h[2].Reason.ShouldStartWith("9.5 mm precipitation forecast");
        result.Forecast48h[1].Reason.ShouldNotContain("Rain forecast unavailable");
    }

    [Fact]
    public void EvaluateWorkability_ReturnsOptimal_WhenTopsoilDryAndNoHeavyRainForecast()
    {
        var series = CreateSeries(
            rain12h: 0.0,
            rain24h: 0.5,
            forecast24h: 1.0,
            forecast48h: 0.5,
            surfaceMoisture: 0.25,
            rootzoneMoisture: 0.42,
            ndvi: 0.74,
            esi: 0.68);

        var result = AgroFormulas.EvaluateWorkability(series);

        result.Status.ShouldBe("Optimal");
        result.SprayingSafe.ShouldBe(true);
        result.Forecast48h.Count.ShouldBe(3);
        result.Forecast48h[0].Status.ShouldBe("Optimal");
        result.Forecast48h[1].Status.ShouldBe("Optimal");
        result.Forecast48h[2].Status.ShouldBe("Optimal");
    }

    [Fact]
    public void EvaluateWorkability_ReturnsMarginal_WhenSurfaceMoistureElevatedWithoutWashoutRain()
    {
        var series = CreateSeries(
            rain12h: 1.0,
            rain24h: 2.5,
            forecast24h: 2.0,
            forecast48h: 1.0,
            surfaceMoisture: 0.39,
            rootzoneMoisture: 0.45,
            ndvi: 0.72,
            esi: 0.65);

        var result = AgroFormulas.EvaluateWorkability(series);

        result.Status.ShouldBe("Marginal");
        result.SprayingSafe.ShouldBe(true);
    }

    [Theory]
    [InlineData(11.0, 0.20, 1.0, false)]
    [InlineData(0.0, 0.20, 5.0, false)]
    [InlineData(0.0, 0.45, 1.0, true)]
    public void EvaluateWorkability_ReturnsBlocked_WhenThresholdsExceeded(
        double rain12h,
        double surfaceMoisture,
        double forecast24h,
        bool expectedSprayingSafe)
    {
        var series = CreateSeries(
            rain12h: rain12h,
            rain24h: rain12h,
            forecast24h: forecast24h,
            forecast48h: 1.0,
            surfaceMoisture: surfaceMoisture,
            rootzoneMoisture: 0.45,
            ndvi: 0.70,
            esi: 0.65);

        var result = AgroFormulas.EvaluateWorkability(series);

        result.Status.ShouldBe("Blocked");
        result.SprayingSafe.ShouldBe((bool?)expectedSprayingSafe);
    }

    [Fact]
    public void EvaluateWorkability_TreatsZeroForecastRainAsSafe()
    {
        var series = CreateSeries(0.0, 0.5, 0.0, 0.0, 0.25, 0.42, 0.74, 0.68);

        var result = AgroFormulas.EvaluateWorkability(series);

        result.Status.ShouldBe("Optimal");
        result.SprayingSafe.ShouldBe(true);
        result.RainForecast24hMm.ShouldBe(0.0);
        result.RainForecast24To48hMm.ShouldBe(0.0);
        result.Forecast48h.Select(p => p.Status).ShouldBe(["Optimal", "Optimal", "Optimal"]);
    }

    [Fact]
    public void EvaluateWorkability_UsesRealForecastForTheFutureWindows()
    {
        var series = CreateSeries(0.0, 0.5, 1.2, 7.4, 0.25, 0.42, 0.74, 0.68);

        var result = AgroFormulas.EvaluateWorkability(series);

        result.SprayingSafe.ShouldBe(true);
        result.Forecast48h[1].Status.ShouldBe("Optimal");
        result.Forecast48h[2].Status.ShouldBe("Blocked");
        result.Forecast48h[2].Reason.ShouldBe("7.4 mm precipitation forecast (chemical washout risk)");
    }

    [Fact]
    public void EvaluateWorkability_ReportsUnknown_WhenForecastIsMissing()
    {
        var series = CreateSeries(0.0, 0.5, null, null, 0.25, 0.42, 0.74, 0.68);

        var result = AgroFormulas.EvaluateWorkability(series);

        result.Status.ShouldBe("Optimal");
        result.SprayingSafe.ShouldBeNull();
        result.RainForecast24hMm.ShouldBeNull();
        result.RainForecast24To48hMm.ShouldBeNull();
        result.ForecastSource.ShouldBeNull();
        result.Forecast48h[1].Status.ShouldBe(AgroFormulas.UnknownStatus);
        result.Forecast48h[2].Status.ShouldBe(AgroFormulas.UnknownStatus);
        result.Forecast48h[1].Reason.ShouldBe("Rain forecast unavailable");
        result.Recommendation.ShouldContain("spraying safety cannot be confirmed");
        result.Recommendation.ShouldNotContain("washout risk is low");
    }

    [Fact]
    public void EvaluateWorkability_StillBlocksSpraying_AfterHeavyRainWithoutForecast()
    {
        var series = CreateSeries(11.0, 11.0, null, null, 0.30, 0.45, 0.70, 0.65);

        var result = AgroFormulas.EvaluateWorkability(series);

        result.Status.ShouldBe("Blocked");
        result.SprayingSafe.ShouldBe(false);
    }

    [Fact]
    public void EvaluateStressAndIrrigation_DetectsHiddenWaterStress_WhenWdiHighAndNdviStable()
    {
        var series = CreateSeries(
            rain12h: 0.0,
            rain24h: 0.0,
            forecast24h: 0.0,
            forecast48h: 0.0,
            surfaceMoisture: 0.20,
            rootzoneMoisture: 0.19,
            ndvi: 0.74,
            esi: 0.32);

        var result = AgroFormulas.EvaluateStressAndIrrigation(
            CropType.Corn,
            "Field #2",
            series.DailySeries);

        result.WaterDeficitIndex.ShouldBeGreaterThan(0.65);
        result.IsHiddenStressDetected.ShouldBeTrue();
        result.IrrigationRecommended.ShouldBeTrue();
        result.RecommendedIrrigationMm.ShouldBeGreaterThan(0.0);
        result.Severity.ShouldBe("Warning");
        result.RecommendedWindowHours.ShouldBe(36);
    }

    [Fact]
    public void EvaluateStressAndIrrigation_ReturnsNoIrrigation_WhenRootzoneHealthy()
    {
        var series = CreateSeries(
            rain12h: 0.0,
            rain24h: 1.0,
            forecast24h: 1.0,
            forecast48h: 1.0,
            surfaceMoisture: 0.26,
            rootzoneMoisture: 0.48,
            ndvi: 0.75,
            esi: 0.72);

        var result = AgroFormulas.EvaluateStressAndIrrigation(
            CropType.Wheat,
            "Field #1",
            series.DailySeries);

        result.IrrigationRecommended.ShouldBeFalse();
        result.RecommendedIrrigationMm.ShouldBe(0.0);
        result.RecommendedWindowHours.ShouldBe(0);
        result.Severity.ShouldBe("Info");
    }

    [Fact]
    public void EvaluateBiomass_FlagsPestAnomaly_WhenNdviDropsWithoutDrought()
    {
        var baseline = Enumerable.Range(0, 14)
            .Select(i => new NasaDailyMetric(
                Date: new DateOnly(2026, 10, 1).AddDays(i),
                PrecipitationMm: 1.0,
                SurfaceMoisture: 0.28,
                RootzoneMoisture: 0.44,
                SolarRadiation: 15.0,
                Ndvi: i == 13 ? 0.56 : 0.76,
                Esi: 0.65))
            .ToList();

        var result = AgroFormulas.EvaluateBiomass("Field #4", baseline);

        result.IsDroughtPresent.ShouldBeFalse();
        result.IsAnomalyDetected.ShouldBeTrue();
        result.DeltaNdvi.ShouldBeLessThan(-0.12);
    }

    [Fact]
    public void EvaluateBiomass_DoesNotFlagPestAnomaly_WhenDroughtPresent()
    {
        var baseline = Enumerable.Range(0, 14)
            .Select(i => new NasaDailyMetric(
                Date: new DateOnly(2026, 10, 1).AddDays(i),
                PrecipitationMm: 0.0,
                SurfaceMoisture: 0.15,
                RootzoneMoisture: 0.22,
                SolarRadiation: 18.0,
                Ndvi: i == 13 ? 0.52 : 0.74,
                Esi: 0.35))
            .ToList();

        var result = AgroFormulas.EvaluateBiomass("Field #2", baseline);

        result.IsDroughtPresent.ShouldBeTrue();
        result.IsAnomalyDetected.ShouldBeFalse();
    }

    [Fact]
    public void Messages_UseInvariantDecimalsAndOneDecimalPercent_UnderCommaCulture()
    {
        using var _ = UseCulture("uk-UA");

        var biomassSeries = Enumerable.Range(0, 14)
            .Select(i => new NasaDailyMetric(
                Date: new DateOnly(2026, 10, 1).AddDays(i),
                PrecipitationMm: 1.0,
                SurfaceMoisture: 0.28,
                RootzoneMoisture: 0.44,
                SolarRadiation: 15.0,
                Ndvi: i == 13 ? 0.56 : 0.76,
                Esi: 0.65))
            .ToList();
        var biomass = AgroFormulas.EvaluateBiomass("Field #4", biomassSeries);
        biomass.Recommendation.ShouldContain("dropped by 24.9% while soil moisture is optimal (0.44)");

        var stress = AgroFormulas.EvaluateStressAndIrrigation(
            CropType.Corn,
            "Field #2",
            CreateSeries(0.0, 0.0, 0.0, 0.0, 0.20, 0.19, 0.74, 0.32).DailySeries);
        stress.Recommendation.ShouldMatch(@"\(WDI \d\.\d{2} while NDVI remains stable\)");
        stress.Recommendation.ShouldMatch(@"irrigation dose of \d+(\.\d)? mm");

        var blocked = AgroFormulas.EvaluateWorkability(CreateSeries(11.0, 11.0, 5.5, 1.0, 0.20, 0.44, 0.74, 0.65));
        blocked.Forecast48h[0].Reason.ShouldBe("11.0 mm rain in last 12h + surface moisture 0.20");
        blocked.Forecast48h[1].Reason.ShouldBe("5.5 mm precipitation forecast (chemical washout risk)");
    }

    private static CultureScope UseCulture(string name) => new(CultureInfo.GetCultureInfo(name));

    private sealed class CultureScope : IDisposable
    {
        private readonly CultureInfo _previous = CultureInfo.CurrentCulture;

        public CultureScope(CultureInfo culture) => CultureInfo.CurrentCulture = culture;

        public void Dispose() => CultureInfo.CurrentCulture = _previous;
    }

    private static FieldSatelliteSeries CreateSeries(
        double rain12h,
        double rain24h,
        double? forecast24h,
        double? forecast48h,
        double surfaceMoisture,
        double rootzoneMoisture,
        double ndvi,
        double esi)
    {
        var metrics = Enumerable.Range(0, 14)
            .Select(i => new NasaDailyMetric(
                Date: new DateOnly(2026, 10, 15).AddDays(i),
                PrecipitationMm: i == 13 ? rain24h : 0.5,
                SurfaceMoisture: surfaceMoisture,
                RootzoneMoisture: rootzoneMoisture,
                SolarRadiation: 15.5,
                Ndvi: ndvi,
                Esi: esi))
            .ToList();

        return new FieldSatelliteSeries(
            DailySeries: metrics,
            RainLast12hMm: rain12h,
            RainLast24hMm: rain24h,
            RainForecast24hMm: forecast24h,
            RainForecast48hMm: forecast48h,
            DataSource: "MOCK_FIXTURE",
            ForecastSource: forecast24h.HasValue ? "MOCK_FIXTURE" : null);
    }
}
