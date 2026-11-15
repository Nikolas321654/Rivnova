using FarmFlow.Api.Infrastructure.Database.Entities;
using FarmFlow.Api.Infrastructure.Nasa;
using FarmFlow.Api.Infrastructure.Spatial;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite;
using NetTopologySuite.Geometries;

namespace FarmFlow.Api.Infrastructure.Database;

public static class DbSeeder
{
    private static readonly GeometryFactory GeometryFactory =
        NtsGeometryServices.Instance.CreateGeometryFactory(srid: GeoCalculator.Wgs84Srid);

    private sealed record SeedFieldSpec(
        Guid Id,
        string Name,
        CropType CropType,
        DateOnly PlantedAt,
        string DemoScenario,
        (double Lon, double Lat)[] Ring);

    private static readonly SeedFieldSpec[] DemoFields =
    [
        new(
            Id: Guid.Parse("11111111-1111-1111-1111-111111111111"),
            Name: "Field 1",
            CropType: CropType.Wheat,
            PlantedAt: new DateOnly(2026, 9, 5),
            DemoScenario: DemoScenarios.Optimal,
            Ring:
            [
                (31.232221, 48.403209), (31.216171, 48.401341), (31.216056, 48.401181), (31.219587, 48.389079),
                (31.234243, 48.393602), (31.234654, 48.393854), (31.232221, 48.403209)
            ]),
        new(
            Id: Guid.Parse("22222222-2222-2222-2222-222222222222"),
            Name: "Field 2",
            CropType: CropType.Corn,
            PlantedAt: new DateOnly(2026, 5, 10),
            DemoScenario: DemoScenarios.WaterStress,
            Ring:
            [
                (33.29175, 49.511103), (33.293689, 49.5102), (33.304028, 49.504613), (33.303718, 49.50258),
                (33.303498, 49.502075), (33.293806, 49.4948), (33.279644, 49.502258), (33.29175, 49.511103)
            ]),
        new(
            Id: Guid.Parse("33333333-3333-3333-3333-333333333333"),
            Name: "Field 3",
            CropType: CropType.Sunflower,
            PlantedAt: new DateOnly(2026, 4, 28),
            DemoScenario: DemoScenarios.RainBlocked,
            Ring:
            [
                (28.559717, 49.068957), (28.569631, 49.06793), (28.569916, 49.068027), (28.570579, 49.068796),
                (28.579466, 49.067092), (28.579423, 49.066625), (28.578701, 49.065421), (28.578587, 49.064465),
                (28.578205, 49.063597), (28.579177, 49.061398), (28.572806, 49.054559), (28.571451, 49.054203),
                (28.571129, 49.054325), (28.570256, 49.055262), (28.563278, 49.0598), (28.560666, 49.062317),
                (28.559719, 49.063668), (28.557019, 49.065132), (28.556479, 49.065686), (28.557804, 49.065414),
                (28.559717, 49.068957)
            ]),
        new(
            Id: Guid.Parse("44444444-4444-4444-4444-444444444444"),
            Name: "Field 4",
            CropType: CropType.Soy,
            PlantedAt: new DateOnly(2026, 5, 15),
            DemoScenario: DemoScenarios.PestAnomaly,
            Ring:
            [
                (32.267837, 47.171785), (32.273781, 47.172543), (32.273888, 47.172704), (32.272387, 47.179092),
                (32.272365, 47.179749), (32.270777, 47.179676), (32.269211, 47.179122), (32.266915, 47.178232),
                (32.264726, 47.176992), (32.264619, 47.176686), (32.265026, 47.174498), (32.265413, 47.173725),
                (32.267837, 47.171785)
            ])
    ];

    public static async Task SeedAsync(AppDbContext db, CancellationToken ct = default)
    {
        var demoIds = DemoFields.Select(d => d.Id).ToArray();
        var existing = await db.Fields
            .Where(f => demoIds.Contains(f.Id) && f.IsDemo)
            .ToDictionaryAsync(f => f.Id, ct);

        foreach (var spec in DemoFields)
        {
            if (!existing.TryGetValue(spec.Id, out var field))
            {
                continue;
            }

            var current = BuildField(spec);
            if (field.Name != current.Name)
            {
                field.Name = current.Name;
            }

            if (!field.Boundary.EqualsExact(current.Boundary))
            {
                field.Boundary = current.Boundary;
                field.Centroid = current.Centroid;
                field.AreaHectares = current.AreaHectares;
            }
        }

        var missingFields = DemoFields
            .Where(spec => !existing.ContainsKey(spec.Id))
            .Select(BuildField)
            .ToList();

        await db.Fields.AddRangeAsync(missingFields, ct);
        await db.SaveChangesAsync(ct);
    }

    private static Field BuildField(SeedFieldSpec spec)
    {
        var coordinates = spec.Ring.Select(p => new Coordinate(p.Lon, p.Lat)).ToArray();
        var boundary = GeometryFactory.CreatePolygon(coordinates);
        GeoCalculator.ValidatePolygon(boundary);

        return new Field
        {
            Id = spec.Id,
            Name = spec.Name,
            CropType = spec.CropType,
            PlantedAt = spec.PlantedAt,
            Boundary = boundary,
            Centroid = GeoCalculator.CalculateCentroid(boundary),
            AreaHectares = GeoCalculator.CalculateAreaHectares(boundary),
            DemoScenario = spec.DemoScenario,
            OwnerId = null,
            IsDemo = true
        };
    }
}
