using System.Security.Claims;
using FarmFlow.Api.Infrastructure.Auth;
using FarmFlow.Api.Infrastructure.Database;
using FarmFlow.Api.Infrastructure.Database.Entities;
using FarmFlow.Api.Infrastructure.Nasa;
using FarmFlow.Api.Infrastructure.Spatial;
using NetTopologySuite.Geometries;

namespace FarmFlow.Api.Features.Fields;

public static class UpdateField
{
    public record Request(
        string? Name,
        CropType? CropType,
        DateOnly? PlantedAt,
        Polygon? Boundary);

    public static void MapEndpoint(IEndpointRouteBuilder app) =>
        app.MapPatch("/api/fields/{id:guid}", Handle)
           .RequireAuthorization()
           .AddEndpointFilter<CsrfValidationFilter>()
           .WithTags("Fields")
           .WithSummary("Updates metadata or GeoJSON boundary for a private user-owned field.");

    public static async Task<IResult> Handle(
        Guid id,
        Request request,
        ClaimsPrincipal principal,
        AppDbContext db,
        INasaClient nasaClient,
        CancellationToken ct)
    {
        var errors = ValidatePatch(request);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var (field, errorResult) = await db.GetOwnedMutableFieldAsync(
            id,
            principal,
            "Demo fields cannot be modified.",
            ct);
        if (errorResult is not null || field is null)
        {
            return errorResult ?? Results.NotFound();
        }

        if (request.Boundary is not null)
        {
            var boundaryError = FieldValidation.TryValidateBoundary(request.Boundary, out var areaHectares);
            if (boundaryError is not null)
            {
                return boundaryError;
            }

            field.Boundary = request.Boundary;
            field.Centroid = GeoCalculator.CalculateCentroid(request.Boundary);
            field.AreaHectares = areaHectares;
        }

        if (request.Name is not null)
        {
            field.Name = request.Name.Trim();
        }

        if (request.CropType is { } cropType)
        {
            field.CropType = cropType;
        }

        if (request.PlantedAt is { } plantedAt)
        {
            field.PlantedAt = plantedAt;
        }

        await db.SaveChangesAsync(ct);

        var summary = await FieldSummaryMapper.ToSummaryAsync(field, nasaClient, ct);
        return Results.Ok(summary);
    }

    private static Dictionary<string, string[]> ValidatePatch(Request request)
    {
        var errors = new Dictionary<string, string[]>();

        if (request.Name is null && request.CropType is null && request.PlantedAt is null && request.Boundary is null)
        {
            errors["request"] = ["At least one field property (name, cropType, plantedAt, or boundary) must be provided."];
            return errors;
        }

        if (request.Name is not null)
        {
            FieldValidation.ValidateName(request.Name, errors, "Field name cannot be empty.");
        }

        if (request.CropType is { } cropType)
        {
            FieldValidation.ValidateCropType(cropType, errors);
        }

        return errors;
    }
}
