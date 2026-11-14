using System.Security.Claims;
using FarmFlow.Api.Infrastructure.Auth;
using FarmFlow.Api.Infrastructure.Database;
using FarmFlow.Api.Infrastructure.Database.Entities;

namespace FarmFlow.Api.Features.Alerts;

public static class SubmitAlertFeedback
{
    public const int MaxAlertTypeLength = 64;
    public const int MaxCommentLength = 500;

    public record Request(
        Guid FieldId,
        string AlertType,
        bool IsAccurate,
        string? Comment);

    public record Response(
        Guid FeedbackId,
        DateTimeOffset RecordedAtUtc);

    public static void MapEndpoint(IEndpointRouteBuilder app) =>
        app.MapPost("/api/alerts/{id:guid}/feedback", Handle)
           .RequireAuthorization()
           .AddEndpointFilter<CsrfValidationFilter>()
           .WithTags("Alerts")
           .WithSummary("Records farmer confirmation or dismissal of an alert.");

    public static async Task<IResult> Handle(
        Guid id,
        Request request,
        ClaimsPrincipal principal,
        AppDbContext db,
        CancellationToken ct)
    {
        if (principal.GetUserIdOrNull() is null)
        {
            return Results.Unauthorized();
        }

        if (id == Guid.Empty)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["id"] = ["Alert ID is required."]
            });
        }

        var trimmedAlertType = request.AlertType?.Trim() ?? string.Empty;
        if (trimmedAlertType.Length == 0 || trimmedAlertType.Length > MaxAlertTypeLength)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["alertType"] = [$"Alert type must be between 1 and {MaxAlertTypeLength} characters."]
            });
        }

        if (!GetActiveAlerts.AlertTypes.Contains(trimmedAlertType))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["alertType"] = ["Unknown alert type."]
            });
        }

        var trimmedComment = string.IsNullOrWhiteSpace(request.Comment)
            ? null
            : request.Comment.Trim();
        if (trimmedComment is { Length: > MaxCommentLength })
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["comment"] = [$"Comment cannot exceed {MaxCommentLength} characters."]
            });
        }

        var field = await db.GetAccessibleFieldAsync(request.FieldId, principal, ct);
        if (field is null)
        {
            return Results.NotFound();
        }

        if (GetActiveAlerts.CreateDeterministicAlertId(field.Id, trimmedAlertType) != id)
        {
            return Results.NotFound();
        }

        var feedback = new AlertFeedback
        {
            Id = Guid.NewGuid(),
            FieldId = field.Id,
            UserId = principal.GetUserIdOrNull(),
            AlertType = trimmedAlertType,
            IsAccurate = request.IsAccurate,
            Comment = trimmedComment,
            CreatedAt = DateTimeOffset.UtcNow
        };

        db.AlertFeedbacks.Add(feedback);
        await db.SaveChangesAsync(ct);

        return Results.Ok(new Response(feedback.Id, feedback.CreatedAt));
    }
}
