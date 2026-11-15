using System.Globalization;
using System.Security.Claims;
using FarmFlow.Api.Features.AgroAnalytics;
using FarmFlow.Api.Infrastructure.Auth;
using FarmFlow.Api.Infrastructure.Database;
using FarmFlow.Api.Infrastructure.Database.Entities;
using FarmFlow.Api.Infrastructure.Ml;
using FarmFlow.Api.Infrastructure.Nasa;

namespace FarmFlow.Api.Features.Predictions;

public static class RecommendCropRotation
{
    public enum RotationPriority
    {
        Balanced,
        WaterConservation,
        MaxYield,
        SoilHealth
    }

    public record CandidateCropDto(
        CropType CropType,
        double OverallScore,
        double PredictedYieldTonsPerHa,
        double RegionalBaselineTonsPerHa,
        double WaterFitScore,
        double SoilHealthScore,
        double YieldScore,
        bool IsRecommendedNext,
        string Rationale);

    public record Response(
        Guid FieldId,
        string FieldName,
        CropType CurrentCropType,
        RotationPriority Priority,
        double ObservedRootzoneMoisture30d,
        CropType RecommendedNextCrop,
        IReadOnlyList<CandidateCropDto> RankedOptions);

    public static void MapEndpoint(IEndpointRouteBuilder app) =>
        app.MapGet("/api/fields/{id:guid}/rotation-advisor", Handle)
           .WithTags("Predictions")
           .WithSummary("Ranks next-season crop rotation options using ONNX yield predictions, NASA moisture fit, and farmer priorities.");

    public static async Task<IResult> Handle(
        Guid id,
        ClaimsPrincipal principal,
        AppDbContext db,
        INasaClient nasaClient,
        OnnxModelRegistry modelRegistry,
        RotationPriority priority = RotationPriority.Balanced,
        CancellationToken ct = default)
    {
        var field = await db.GetAccessibleFieldAsync(id, principal, ct);
        if (field is null)
        {
            return Results.NotFound();
        }

        var series = await nasaClient.GetFieldSeriesAsync(
            field.Centroid.Y, field.Centroid.X, field.DemoScenario, days: 30, ct: ct);
        var features = PredictYield.ExtractFeatures(series.DailySeries);

        var (yieldWeight, waterWeight, soilWeight) = GetPriorityWeights(priority);
        var scored = new List<CandidateCropDto>();

        foreach (var candidate in Enum.GetValues<CropType>())
        {
            var predictedYield = modelRegistry.PredictYield(
                candidate,
                features.AccumulatedPrecipMm30d,
                features.AvgRootzoneMoisture30d,
                features.PeakNdvi30d,
                features.StressDaysCount30d);

            var baseline = PredictYield.GetRegionalBaseline(candidate);
            var deltaPercent = ((predictedYield - baseline) / baseline) * 100.0;
            var yieldScore = Math.Round(Math.Clamp(50.0 + deltaPercent * 1.5, 0.0, 100.0), 1);

            var targetMoisture = AgroFormulas.GetTargetRootzoneMoisture(candidate);
            var moistureGap = Math.Max(0.0, targetMoisture - features.AvgRootzoneMoisture30d);
            var waterScore = Math.Round(Math.Clamp(100.0 - moistureGap * 250.0, 0.0, 100.0), 1);

            var (soilScore, rotationNote) = ScoreAgronomicRotation(field.CropType, candidate);

            var overall = Math.Round(
                yieldWeight * yieldScore + waterWeight * waterScore + soilWeight * soilScore, 1);

            var rationale = BuildRationale(
                candidate, predictedYield, baseline, targetMoisture, features.AvgRootzoneMoisture30d, rotationNote);

            scored.Add(new CandidateCropDto(
                CropType: candidate,
                OverallScore: overall,
                PredictedYieldTonsPerHa: predictedYield,
                RegionalBaselineTonsPerHa: baseline,
                WaterFitScore: waterScore,
                SoilHealthScore: soilScore,
                YieldScore: yieldScore,
                IsRecommendedNext: false,
                Rationale: rationale));
        }

        var ranked = scored
            .OrderByDescending(c => c.OverallScore)
            .ThenByDescending(c => c.PredictedYieldTonsPerHa)
            .Select((c, index) => index == 0 ? c with { IsRecommendedNext = true } : c)
            .ToList();

        return Results.Ok(new Response(
            FieldId: field.Id,
            FieldName: field.Name,
            CurrentCropType: field.CropType,
            Priority: priority,
            ObservedRootzoneMoisture30d: features.AvgRootzoneMoisture30d,
            RecommendedNextCrop: ranked[0].CropType,
            RankedOptions: ranked));
    }

    private static (double YieldWeight, double WaterWeight, double SoilWeight) GetPriorityWeights(RotationPriority priority) =>
        priority switch
        {
            RotationPriority.WaterConservation => (0.20, 0.60, 0.20),
            RotationPriority.MaxYield => (0.65, 0.15, 0.20),
            RotationPriority.SoilHealth => (0.20, 0.25, 0.55),
            _ => (0.35, 0.35, 0.30)
        };

    private static (double Score, string Note) ScoreAgronomicRotation(CropType current, CropType next)
    {
        if (current == next)
        {
            return (20.0, "Continuous monoculture increases pest and disease carryover.");
        }

        return (current, next) switch
        {
            (_, CropType.Soy) => (95.0, "Legume fixes atmospheric nitrogen and restores soil fertility."),
            (CropType.Soy, CropType.Wheat or CropType.Corn) => (90.0, "Cereal benefits directly from residual legume nitrogen."),
            (CropType.Sunflower, CropType.Wheat or CropType.Corn) => (82.0, "Cereal breaks broadleaf disease cycles after sunflower."),
            (CropType.Wheat or CropType.Corn, CropType.Sunflower) => (75.0, "Deep taproot utilizes subsoil moisture and breaks cereal pests."),
            (CropType.Wheat, CropType.Corn) or (CropType.Corn, CropType.Wheat) => (55.0, "Cereal-after-cereal sequence offers moderate rotation diversity."),
            _ => (45.0, "Broadleaf-after-broadleaf carries shared Sclerotinia disease risk.")
        };
    }

    private static string BuildRationale(
        CropType candidate,
        double predictedYield,
        double baseline,
        double targetMoisture,
        double observedMoisture,
        string rotationNote)
    {
        var moistureNote = observedMoisture >= targetMoisture
            ? string.Create(CultureInfo.InvariantCulture, $"Field moisture ({observedMoisture:0.00}) meets {candidate} target ({targetMoisture:0.00}).")
            : string.Create(CultureInfo.InvariantCulture, $"Moisture deficit of {targetMoisture - observedMoisture:0.00} below {candidate} target ({targetMoisture:0.00}).");

        return string.Create(CultureInfo.InvariantCulture, $"{rotationNote} {moistureNote} Estimated yield: {predictedYield:0.00} t/ha (baseline {baseline:0.00} t/ha).");
    }
}
