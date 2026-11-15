using FarmFlow.Api.Infrastructure.Database.Entities;

namespace FarmFlow.Api.Features.Auth;

public record UserProfileDto(
    Guid Id,
    string DisplayName,
    string Email,
    string? AvatarUrl,
    bool IsDemoAccount)
{
    public const string DemoSubjectPrefix = "demo:";

    public static UserProfileDto FromEntity(User user) =>
        new(
            user.Id,
            user.EffectiveDisplayName,
            user.Email,
            user.AvatarUrl,
            user.GoogleSubjectId.StartsWith(DemoSubjectPrefix, StringComparison.Ordinal));
}
