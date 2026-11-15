using System.Globalization;
using FarmFlow.Api.Infrastructure.Database.Entities;
using FarmFlow.Api.Infrastructure.Nasa.NasaModels;

namespace FarmFlow.Api.Features.AgroAnalytics;

public static class AgroFormulas
{
    public const double WaterDeficitAlertThreshold = 0.65;
    public const double BiomassAnomalyDeltaThreshold = -0.12;
    public const double DroughtRootzoneThreshold = 0.35;

    private sealed record CropWaterProfile(double TargetRootzoneMoisture, double EffectiveRootDepthMm, double PorosityFactor);

    private static readonly Dictionary<CropType, CropWaterProfile> CropProfiles = new()
    {
        [CropType.Wheat] = new(0.45, 140.0, 0.40),
        [CropType.Corn] = new(0.55, 150.0, 0.40),
        [CropType.Sunflower] = new(0.40, 160.0, 0.38),
        [CropType.Soy] = new(0.50, 145.0, 0.40)
    };

    public record WorkabilityWindowPeriod(string Period, string Status, string Reason);

    public const string UnknownStatus = "Unknown";
    private const double WashoutForecastThresholdMm = 5.0;

    public record WorkabilityEvaluation(
        string Status,
        bool? SprayingSafe,
        double? RainLast12hMm,
        double? RainLast24hMm,
        double? RainForecast24hMm,
        double? RainForecast24To48hMm,
        string? ForecastSource,
        string? RecentRainSource,
        double SurfaceMoisture,
        IReadOnlyList<WorkabilityWindowPeriod> Forecast48h,
        string Recommendation);

    public record StressAndIrrigationEvaluation(
        double WaterDeficitIndex,
        double Threshold,
        double RootzoneMoisture,
        double CropTargetMoisture,
        double EvaporativeStressIndex,
        double NdviCurrent,
        bool IsHiddenStressDetected,
        string Severity,
        bool IrrigationRecommended,
        double RecommendedIrrigationMm,
        int RecommendedWindowHours,
        string Recommendation);

    public record BiomassEvaluation(
        double CurrentNdvi,
        double Ndvi14DayAvg,
        double DeltaNdvi,
        double DeltaPercent,
        double RootzoneMoisture,
        bool IsDroughtPresent,
        bool IsAnomalyDetected,
        string Recommendation);

    public record ImpactMetricsEvaluation(
        double EstimatedWaterSavedM3PerHa,
        bool PreventedRunoffRisk,
        int EarlyWarningLeadTimeDays);

    public static double GetTargetRootzoneMoisture(CropType cropType) =>
        CropProfiles[cropType].TargetRootzoneMoisture;

    public static double CalculateWaterDeficitIndex(double rootzoneMoisture, double esi)
    {
        var raw = 1.0 - (0.6 * rootzoneMoisture + 0.4 * esi);
        return Math.Round(Math.Clamp(raw, 0.0, 1.0), 3);
    }

    public static WorkabilityEvaluation EvaluateWorkability(FieldSatelliteSeries series)
    {
        var latest = series.Latest;
        var forecast24h = series.RainForecast24hMm;
        var forecast24To48h = series.RainForecast48hMm;
        var washoutForecast = forecast24h is >= WashoutForecastThresholdMm;

        var status = (series.RainLast12hMm, series.RainLast24hMm, latest.SurfaceMoisture, washoutForecast) switch
        {
            (null, _, _, _) => UnknownStatus,
            (_, null, _, _) => UnknownStatus,
            ( > 10.0, _, _, _) => "Blocked",
            (_, < 2.0, < 0.35, false) => "Optimal",
            (_, _, < 0.45, false) => "Marginal",
            _ => "Blocked"
        };

        bool? sprayingSafe = forecast24h.HasValue && series.RainLast12hMm.HasValue ? true : null;
        if (series.RainLast12hMm > 10.0 || washoutForecast)
        {
            sprayingSafe = false;
        }

        var next24hStatus = status != UnknownStatus && forecast24h is { } next24h
            ? ResolveForecastDayStatus(next24h, status)
            : UnknownStatus;
        var next48hStatus = forecast24To48h is { } next48h && next24hStatus != UnknownStatus
            ? ResolveForecastDayStatus(next48h, next24hStatus)
            : UnknownStatus;

        var forecast48h = new List<WorkabilityWindowPeriod>
        {
            new("Today", status, BuildTodayWorkabilityReason(status, series.RainLast12hMm, latest.SurfaceMoisture)),
            new("Next 24h", next24hStatus, BuildForecastWorkabilityReason(next24hStatus, forecast24h)),
            new("24h\u201348h", next48hStatus, BuildForecastWorkabilityReason(next48hStatus, forecast24To48h))
        };

        return new WorkabilityEvaluation(
            Status: status,
            SprayingSafe: sprayingSafe,
            RainLast12hMm: series.RainLast12hMm is { } r12 ? Math.Round(r12, 1) : null,
            RainLast24hMm: series.RainLast24hMm is { } recent24 ? Math.Round(recent24, 1) : null,
            RainForecast24hMm: forecast24h is { } r24 ? Math.Round(r24, 1) : null,
            RainForecast24To48hMm: forecast24To48h is { } r48 ? Math.Round(r48, 1) : null,
            ForecastSource: forecast24h.HasValue ? series.ForecastSource : null,
            RecentRainSource: series.RainLast12hMm.HasValue ? series.RecentRainSource : null,
            SurfaceMoisture: Math.Round(latest.SurfaceMoisture, 3),
            Forecast48h: forecast48h,
            Recommendation: BuildWorkabilityMessage(status, sprayingSafe));
    }

    public static StressAndIrrigationEvaluation EvaluateStressAndIrrigation(
        CropType cropType,
        string fieldName,
        IReadOnlyList<NasaDailyMetric> dailySeries)
    {
        var latest = dailySeries[^1];
        var profile = CropProfiles[cropType];

        var wdi = CalculateWaterDeficitIndex(latest.RootzoneMoisture, latest.Esi);
        var ndvi14dAvg = dailySeries.TakeLast(14).Average(m => m.Ndvi);
        var ndviDelta = latest.Ndvi - ndvi14dAvg;

        var isHiddenStress = wdi > WaterDeficitAlertThreshold && ndviDelta >= -0.05;
        var irrigationRecommended = wdi > WaterDeficitAlertThreshold ||
                                    latest.RootzoneMoisture < profile.TargetRootzoneMoisture * 0.55;

        var irrigationMm = irrigationRecommended
            ? Math.Round(Math.Max(0.0, (profile.TargetRootzoneMoisture - latest.RootzoneMoisture)
                * profile.EffectiveRootDepthMm * profile.PorosityFactor), 1)
            : 0.0;

        var windowHours = wdi > 0.78 ? 24 : 36;
        var severity = wdi switch
        {
            > 0.78 => "Critical",
            > WaterDeficitAlertThreshold => "Warning",
            _ => "Info"
        };

        var stressPrefix = isHiddenStress
            ? string.Create(CultureInfo.InvariantCulture, $"Hidden water stress detected (WDI {wdi:0.00} while NDVI remains stable). ")
            : string.Empty;

        var recommendation = irrigationRecommended
            ? string.Create(CultureInfo.InvariantCulture, $"{fieldName}: {stressPrefix}Recommended irrigation dose of {irrigationMm:0.#} mm within {windowHours} hours to prevent turgor loss.")
            : string.Create(CultureInfo.InvariantCulture, $"{fieldName}: Rootzone moisture ({latest.RootzoneMoisture:0.00}) and transpiration are within healthy limits.");

        return new StressAndIrrigationEvaluation(
            WaterDeficitIndex: wdi,
            Threshold: WaterDeficitAlertThreshold,
            RootzoneMoisture: Math.Round(latest.RootzoneMoisture, 3),
            CropTargetMoisture: profile.TargetRootzoneMoisture,
            EvaporativeStressIndex: Math.Round(latest.Esi, 3),
            NdviCurrent: Math.Round(latest.Ndvi, 3),
            IsHiddenStressDetected: isHiddenStress,
            Severity: severity,
            IrrigationRecommended: irrigationRecommended,
            RecommendedIrrigationMm: irrigationMm,
            RecommendedWindowHours: irrigationRecommended ? windowHours : 0,
            Recommendation: recommendation);
    }

    public static BiomassEvaluation EvaluateBiomass(string fieldName, IReadOnlyList<NasaDailyMetric> dailySeries)
    {
        var latest = dailySeries[^1];
        var ndvi14DayAvg = dailySeries.TakeLast(14).Average(m => m.Ndvi);
        var deltaNdvi = latest.Ndvi - ndvi14DayAvg;
        var deltaPercent = ndvi14DayAvg > 0.0 ? deltaNdvi / ndvi14DayAvg * 100.0 : 0.0;

        var isDroughtPresent = latest.RootzoneMoisture < DroughtRootzoneThreshold;
        var isAnomalyDetected = deltaNdvi < BiomassAnomalyDeltaThreshold && !isDroughtPresent;

        var recommendation = (isAnomalyDetected, isDroughtPresent) switch
        {
            (true, _) => string.Create(CultureInfo.InvariantCulture, $"{fieldName}: Biomass index dropped by {Math.Abs(deltaPercent):0.0}% while soil moisture is optimal ({latest.RootzoneMoisture:0.00}). Potential localized pest, disease, or weed outbreak — scout inspection required."),
            (false, true) => string.Create(CultureInfo.InvariantCulture, $"{fieldName}: Vegetation index variation is accompanied by low rootzone moisture ({latest.RootzoneMoisture:0.00}). Prioritize moisture recovery."),
            _ => $"{fieldName}: Biomass growth trajectory is within normal seasonal bounds."
        };

        return new BiomassEvaluation(
            CurrentNdvi: Math.Round(latest.Ndvi, 3),
            Ndvi14DayAvg: Math.Round(ndvi14DayAvg, 3),
            DeltaNdvi: Math.Round(deltaNdvi, 3),
            DeltaPercent: Math.Round(deltaPercent, 1),
            RootzoneMoisture: Math.Round(latest.RootzoneMoisture, 3),
            IsDroughtPresent: isDroughtPresent,
            IsAnomalyDetected: isAnomalyDetected,
            Recommendation: recommendation);
    }

    public static ImpactMetricsEvaluation CalculateImpactMetrics(
        WorkabilityEvaluation workability,
        StressAndIrrigationEvaluation stress)
    {
        var waterSaved = stress.IrrigationRecommended
            ? Math.Round(stress.RecommendedIrrigationMm * 10.0 * 0.3, 1)
            : 15.0;

        return new ImpactMetricsEvaluation(
            EstimatedWaterSavedM3PerHa: waterSaved,
            PreventedRunoffRisk: workability.SprayingSafe == false,
            EarlyWarningLeadTimeDays: stress.IsHiddenStressDetected ? 4 : 0);
    }

    private static string BuildTodayWorkabilityReason(string status, double? rain12h, double surfaceMoisture) =>
        status switch
        {
            UnknownStatus => "Recent rainfall unavailable; machinery safety cannot be confirmed",
            "Blocked" => string.Create(CultureInfo.InvariantCulture, $"{rain12h:0.0} mm rain in last 12h + surface moisture {surfaceMoisture:0.00}"),
            "Marginal" => string.Create(CultureInfo.InvariantCulture, $"Elevated surface moisture ({surfaceMoisture:0.00}); traction caution"),
            _ => "Dry topsoil and clear weather window"
        };

    private static string BuildForecastWorkabilityReason(string status, double? forecastRainMm) =>
        (status, forecastRainMm) switch
        {
            (_, null) => "Rain forecast unavailable",
            (UnknownStatus, { } rain) => string.Create(CultureInfo.InvariantCulture,
                $"{rain:0.0} mm precipitation forecast; recent rainfall or preceding conditions are unavailable, so machinery safety cannot be confirmed"),
            ("Blocked", { } rain) => string.Create(CultureInfo.InvariantCulture, $"{rain:0.0} mm precipitation forecast (chemical washout risk)"),
            ("Marginal", _) => "Surface drying in progress; moderate wheel slip risk",
            _ => "Favorable bearing capacity and low washout risk"
        };

    private static string ResolveForecastDayStatus(double forecastRainMm, string previousStatus) =>
        (forecastRainMm >= 5.0, previousStatus == "Blocked") switch
        {
            (true, _) => "Blocked",
            (false, true) => "Marginal",
            _ => "Optimal"
        };

    public static string BuildSprayingRestrictionMessage(WorkabilityEvaluation workability) =>
        workability.RainForecast24hMm is >= WashoutForecastThresholdMm
            ? string.Create(CultureInfo.InvariantCulture,
                $"Do not spray: {workability.RainForecast24hMm:0.0} mm of rain is forecast in the next 24 hours, creating fertilizer and pesticide washout risk.")
            : string.Create(CultureInfo.InvariantCulture,
                $"Do not spray: {workability.RainLast12hMm:0.0} mm of rain fell in the last 12 hours, creating fertilizer and pesticide washout risk.");

    public static string BuildMachineryMessage(WorkabilityEvaluation workability) =>
        workability.Status == "Marginal"
            ? string.Create(CultureInfo.InvariantCulture,
                $"Marginal topsoil moisture ({workability.SurfaceMoisture:0.00}): light operations allowed, but monitor heavy machinery traction.")
            : string.Create(CultureInfo.InvariantCulture,
                $"Keep heavy machinery off: wet topsoil ({workability.SurfaceMoisture:0.00}) or recent heavy rain creates high compaction and sinking risk.");

    private static string BuildWorkabilityMessage(string status, bool? sprayingSafe) =>
        (status, sprayingSafe) switch
        {
            (UnknownStatus, _) => "Recent rainfall unavailable; machinery safety cannot be confirmed. Spraying is assessed separately.",
            ("Optimal", true) => "Soil bearing capacity is optimal and washout risk is low. Safe for machinery and fertilizer/pesticide application.",
            ("Marginal", true) => "Marginal topsoil moisture: light operations allowed, but monitor heavy machinery traction.",
            ("Optimal", null) => "Soil bearing capacity is optimal for machinery. Rain forecast is unavailable, so spraying safety cannot be confirmed.",
            ("Marginal", null) => "Marginal topsoil moisture: light operations allowed, but monitor heavy machinery traction. Rain forecast is unavailable, so spraying safety cannot be confirmed.",
            (_, false) => "Blocked: High risk of nitrogen/fungicide washout and topsoil compaction by heavy machinery.",
            _ => "Blocked: Excessive topsoil moisture creates high compaction and machinery sinking risk."
        };
}
