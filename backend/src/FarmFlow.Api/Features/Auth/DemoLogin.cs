using FarmFlow.Api.Infrastructure.Auth;
using FarmFlow.Api.Infrastructure.Database;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FarmFlow.Api.Features.Auth;

public static class DemoLogin
{
    public static void MapEndpoint(IEndpointRouteBuilder app) =>
        app.MapPost("/api/auth/demo", Handle)
           .AddEndpointFilter<CsrfValidationFilter>()
           .WithTags("Auth")
           .WithSummary("Starts an isolated demo farmer session without external OAuth registration.");

    public static async Task<IResult> Handle(
        HttpContext httpContext,
        AppDbContext db,
        IOptions<AuthOptions> authOptions,
        CancellationToken ct)
    {
        if (!authOptions.Value.EnableDemoLogin)
        {
            return Results.NotFound();
        }

        if (httpContext.User.GetUserIdOrNull() is { } existingUserId)
        {
            var existingUser = await db.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == existingUserId, ct);

            if (existingUser is not null)
            {
                return Results.Ok(new GetCurrentUser.Response(true, UserProfileDto.FromEntity(existingUser)));
            }
        }

        var subject = $"{UserProfileDto.DemoSubjectPrefix}{Guid.NewGuid():N}";
        var user = await GoogleUserSync.UpsertBySubjectAsync(
            db,
            subject: subject,
            email: "demo@farmflow.local",
            displayName: "Demo Farmer",
            avatarUrl: null,
            ct: ct);

        var principal = AuthConfiguration.CreateCookiePrincipal(user.Id, user.GoogleSubjectId);
        await httpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            principal,
            new AuthenticationProperties { IsPersistent = true });

        return Results.Ok(new GetCurrentUser.Response(true, UserProfileDto.FromEntity(user)));
    }
}
