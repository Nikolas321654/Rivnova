using System.Security.Claims;
using FarmFlow.Api.Infrastructure.Auth;
using FarmFlow.Api.Infrastructure.Database;
using FarmFlow.Api.Infrastructure.Database.Entities;
using FarmFlow.Api.Infrastructure.Nasa;
using FarmFlow.Api.Infrastructure.Spatial;
using NetTopologySuite.Geometries;

namespace FarmFlow.Api.Features.Fields;

public static class CreateField
{
    public record Request(
        string Name,
        CropType CropType,
        DateOnly PlantedAt,
        Polygon? Boundary);

    public static void MapEndpoint(IEndpointRouteBuilder app) =>
        app.MapPost("/api/fields", Handle)
           .RequireAuthorization()
           .AddEndpointFilter<CsrfValidationFilter>()
           .WithTags("Fields")
           .WithSummary("Creates a private field for the signed-in user from a GeoJSON polygon.");

    public static async Task<IResult> Handle(
        Request request,
        ClaimsPrincipal principal,
        AppDbContext db,
        INasaClient nasaClient,
        CancellationToken ct)
    {
        var userId = principal.GetUserIdOrNull();
        if (userId is null)
        {
            return Results.Unauthorized();
        }
        var errors = ValidateMetadata(request);
        if (errors.Count > 0)
        {
            return Results.ValidationProblem(errors);
        }

        var boundary = request.Boundary!;
        var boundaryError = FieldValidation.TryValidateBoundary(boundary, out var areaHectares);
        if (boundaryError is not null)
        {
            return boundaryError;
        }

        var field = new Field
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            CropType = request.CropType,
            PlantedAt = request.PlantedAt,
            Boundary = boundary,
            Centroid = GeoCalculator.CalculateCentroid(boundary),
            AreaHectares = areaHectares,
            DemoScenario = null,
            OwnerId = userId.Value,
            IsDemo = false
        };

        db.Fields.Add(field);
        await db.SaveChangesAsync(ct);

        var summary = await FieldSummaryMapper.ToSummaryAsync(field, nasaClient, ct);
        return Results.Created($"/api/fields/{field.Id}", summary);
    }

    private static Dictionary<string, string[]> ValidateMetadata(Request request)
    {
        var errors = new Dictionary<string, string[]>();
        FieldValidation.ValidateName(request.Name, errors, "Field name is required.");
        FieldValidation.ValidateCropType(request.CropType, errors);

        if (request.Boundary is null)
        {
            errors["boundary"] = ["Field boundary polygon is required."];
        }

        return errors;
    }
}
