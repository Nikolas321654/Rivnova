using FarmFlow.Api.Infrastructure.Database.Entities;
using FarmFlow.Api.Infrastructure.Spatial;
using NetTopologySuite.Geometries;

namespace FarmFlow.Api.Features.Fields;

internal static class FieldValidation
{
    public const int MaxNameLength = 200;

    public static void ValidateName(string? name, IDictionary<string, string[]> errors, string emptyMessage)
    {
        var trimmed = name?.Trim() ?? string.Empty;
        if (trimmed.Length == 0)
        {
            errors["name"] = [emptyMessage];
        }
        else if (trimmed.Length > MaxNameLength)
        {
            errors["name"] = [$"Field name cannot exceed {MaxNameLength} characters."];
        }
    }

    public static void ValidateCropType(CropType cropType, IDictionary<string, string[]> errors)
    {
        if (!Enum.IsDefined(cropType))
        {
            errors["cropType"] = ["CropType must be Wheat, Corn, Sunflower, or Soy."];
        }
    }

    public static IResult? TryValidateBoundary(Polygon boundary, out double areaHectares)
    {
        try
        {
            GeoCalculator.ValidatePolygon(boundary);
        }
        catch (ArgumentException ex)
        {
            areaHectares = 0.0;
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["boundary"] = [ex.Message]
            });
        }

        areaHectares = GeoCalculator.CalculateAreaHectares(boundary);
        if (areaHectares <= 0.0)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["boundary"] = ["Field boundary area must be greater than zero hectares."]
            });
        }

        return null;
    }
}
