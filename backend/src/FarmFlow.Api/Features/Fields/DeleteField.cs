using System.Security.Claims;
using FarmFlow.Api.Infrastructure.Auth;
using FarmFlow.Api.Infrastructure.Database;

namespace FarmFlow.Api.Features.Fields;

public static class DeleteField
{
    public static void MapEndpoint(IEndpointRouteBuilder app) =>
        app.MapDelete("/api/fields/{id:guid}", Handle)
           .RequireAuthorization()
           .AddEndpointFilter<CsrfValidationFilter>()
           .WithTags("Fields")
           .WithSummary("Deletes a private user-owned field from the catalog.");

    public static async Task<IResult> Handle(
        Guid id,
        ClaimsPrincipal principal,
        AppDbContext db,
        CancellationToken ct)
    {
        var (field, errorResult) = await db.GetOwnedMutableFieldAsync(
            id,
            principal,
            "Demo fields cannot be deleted.",
            ct);
        if (errorResult is not null || field is null)
        {
            return errorResult ?? Results.NotFound();
        }

        db.Fields.Remove(field);
        await db.SaveChangesAsync(ct);

        return Results.NoContent();
    }
}
