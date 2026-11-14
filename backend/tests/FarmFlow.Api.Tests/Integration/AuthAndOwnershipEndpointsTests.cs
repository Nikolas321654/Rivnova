using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FarmFlow.Api.Features.Auth;
using FarmFlow.Api.Features.Fields;
using FarmFlow.Api.Infrastructure.Auth;
using FarmFlow.Api.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.IO.Converters;
using Shouldly;
using Xunit;

namespace FarmFlow.Api.Tests.Integration;

[Collection(PostgresIntegrationCollection.Name)]
[Trait("Category", "Integration")]
public sealed class AuthAndOwnershipEndpointsTests(FarmFlowWebFactory factory) : IAsyncLifetime
{
    private static readonly JsonSerializerOptions JsonOptions = CreateJsonOptions();

    public async ValueTask InitializeAsync() => await factory.ResetDatabaseAsync();

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;

    [Fact]
    public async Task GoogleUserSync_KeysBySubjectAndPreservesCustomDisplayNameAcrossRepeatLogins()
    {
        await factory.ExecuteWithDbAsync(async db =>
        {
            var created = await GoogleUserSync.UpsertBySubjectAsync(
                db,
                subject: "google-sub-123",
                email: "old.email@gmail.com",
                displayName: "Olena Google",
                avatarUrl: "https://lh3.googleusercontent.com/avatar1",
                CancellationToken.None);

            created.CustomDisplayName.ShouldBeNull();
            created.EffectiveDisplayName.ShouldBe("Olena Google");

            created.CustomDisplayName = "Olena (Cherkasy Farm)";
            await db.SaveChangesAsync();

            var updated = await GoogleUserSync.UpsertBySubjectAsync(
                db,
                subject: "google-sub-123",
                email: "new.email@gmail.com",
                displayName: "Olena Updated On Google",
                avatarUrl: "https://lh3.googleusercontent.com/avatar2",
                CancellationToken.None);

            updated.Id.ShouldBe(created.Id);
            updated.Email.ShouldBe("new.email@gmail.com");
            updated.GoogleDisplayName.ShouldBe("Olena Updated On Google");
            updated.AvatarUrl.ShouldBe("https://lh3.googleusercontent.com/avatar2");
            updated.CustomDisplayName.ShouldBe("Olena (Cherkasy Farm)");
            updated.EffectiveDisplayName.ShouldBe("Olena (Cherkasy Farm)");
            (await db.Users.CountAsync()).ShouldBe(1);
        });
    }

    [Fact]
    public async Task AuthMeAndProfilePatch_HandlesGuestAndAuthenticatedCustomDisplayName()
    {
        using var guestClient = factory.CreateClient();
        var guestMe = await guestClient.GetFromJsonAsync<GetCurrentUser.Response>(
            "/api/auth/me",
            JsonOptions,
            TestContext.Current.CancellationToken);
        guestMe.ShouldNotBeNull();
        guestMe.Authenticated.ShouldBeFalse();
        guestMe.User.ShouldBeNull();

        var unauthPatch = await guestClient.PatchAsJsonAsync(
            "/api/users/me",
            new { displayName = "Guest Attempt" },
            TestContext.Current.CancellationToken);
        unauthPatch.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);

        var user = await factory.SeedUserAsync(
            "sub-profile-1",
            "olena@example.com",
            "Olena Google",
            customDisplayName: null);
        using var authedClient = await factory.CreateAuthenticatedClientAsync(user.Id);

        var meBefore = await authedClient.GetFromJsonAsync<GetCurrentUser.Response>(
            "/api/auth/me",
            JsonOptions,
            TestContext.Current.CancellationToken);
        meBefore.ShouldNotBeNull();
        meBefore.Authenticated.ShouldBeTrue();
        meBefore.User.ShouldNotBeNull();
        meBefore.User.DisplayName.ShouldBe("Olena Google");

        var blankPatch = await authedClient.PatchAsJsonAsync(
            "/api/users/me",
            new { displayName = "   " },
            TestContext.Current.CancellationToken);
        blankPatch.StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var patchResponse = await authedClient.PatchAsJsonAsync(
            "/api/users/me",
            new { displayName = "  My Custom Farm Name  " },
            TestContext.Current.CancellationToken);
        patchResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        var updatedProfile = await patchResponse.Content.ReadFromJsonAsync<UserProfileDto>(
            JsonOptions,
            TestContext.Current.CancellationToken);
        updatedProfile.ShouldNotBeNull();
        updatedProfile.DisplayName.ShouldBe("My Custom Farm Name");
        updatedProfile.Email.ShouldBe("olena@example.com");

        var logoutResponse = await authedClient.PostAsync(
            "/api/auth/logout",
            content: null,
            TestContext.Current.CancellationToken);
        logoutResponse.StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task MutationsWithoutCsrfToken_ReturnForbidden()
    {
        var user = await factory.SeedUserAsync("sub-csrf-1", "csrf@example.com", "CSRF User");
        using var noCsrfClient = await factory.CreateAuthenticatedClientAsync(user.Id, attachCsrf: false);

        var patchResponse = await noCsrfClient.PatchAsJsonAsync(
            "/api/users/me",
            new { displayName = "Blocked" },
            TestContext.Current.CancellationToken);
        patchResponse.StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        var createResponse = await noCsrfClient.PostAsJsonAsync(
            "/api/fields",
            BuildValidFieldPayload("Blocked Field"),
            TestContext.Current.CancellationToken);
        createResponse.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GuestAndCrossUserIsolation_EnforcedAcrossFieldsDeleteAndAnalytics()
    {
        await factory.ExecuteWithDbAsync(db => DbSeeder.SeedAsync(db));

        var owner = await factory.SeedUserAsync("sub-owner-a", "a@example.com", "Farmer A");
        var otherUser = await factory.SeedUserAsync("sub-owner-b", "b@example.com", "Farmer B");

        using var guestClient = factory.CreateClient();
        using var ownerClient = await factory.CreateAuthenticatedClientAsync(owner.Id);
        using var otherClient = await factory.CreateAuthenticatedClientAsync(otherUser.Id);

        var guestCreate = await guestClient.PostAsJsonAsync(
            "/api/fields",
            BuildValidFieldPayload("Guest Field"),
            TestContext.Current.CancellationToken);
        guestCreate.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);

        var demoId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var guestDeleteDemo = await guestClient.DeleteAsync(
            $"/api/fields/{demoId}",
            TestContext.Current.CancellationToken);
        guestDeleteDemo.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);

        var authDeleteDemo = await ownerClient.DeleteAsync(
            $"/api/fields/{demoId}",
            TestContext.Current.CancellationToken);
        authDeleteDemo.StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        var createResponse = await ownerClient.PostAsJsonAsync(
            "/api/fields",
            BuildValidFieldPayload("Farmer A Private Field"),
            TestContext.Current.CancellationToken);
        createResponse.StatusCode.ShouldBe(HttpStatusCode.Created);
        var privateField = await createResponse.Content.ReadFromJsonAsync<FieldSummaryResponse>(
            JsonOptions,
            TestContext.Current.CancellationToken);
        privateField.ShouldNotBeNull();
        privateField.IsDemo.ShouldBeFalse();

        var guestFields = await guestClient.GetFromJsonAsync<List<FieldSummaryResponse>>(
            "/api/fields",
            JsonOptions,
            TestContext.Current.CancellationToken);
        guestFields.ShouldNotBeNull();
        guestFields.Count.ShouldBe(4);
        guestFields.ShouldAllBe(f => f.IsDemo);

        (await guestClient.GetAsync($"/api/fields/{privateField.Id}", TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await guestClient.GetAsync($"/api/fields/{privateField.Id}/dashboard", TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await guestClient.GetAsync($"/api/fields/{privateField.Id}/workability", TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await guestClient.GetAsync($"/api/fields/{privateField.Id}/stress", TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await guestClient.GetAsync($"/api/fields/{privateField.Id}/biomass", TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.NotFound);

        var otherFields = await otherClient.GetFromJsonAsync<List<FieldSummaryResponse>>(
            "/api/fields",
            JsonOptions,
            TestContext.Current.CancellationToken);
        otherFields.ShouldNotBeNull();
        otherFields.Count.ShouldBe(4);

        (await otherClient.GetAsync($"/api/fields/{privateField.Id}", TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await otherClient.GetAsync($"/api/fields/{privateField.Id}/dashboard", TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await otherClient.DeleteAsync($"/api/fields/{privateField.Id}", TestContext.Current.CancellationToken))
            .StatusCode.ShouldBe(HttpStatusCode.NotFound);

        var ownerFields = await ownerClient.GetFromJsonAsync<List<FieldSummaryResponse>>(
            "/api/fields",
            JsonOptions,
            TestContext.Current.CancellationToken);
        ownerFields.ShouldNotBeNull();
        ownerFields.Count.ShouldBe(5);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var historyQuery = $"history?from={today.AddDays(-100):yyyy-MM-dd}&to={today:yyyy-MM-dd}";
        (await guestClient.GetAsync($"/api/fields/{privateField.Id}/{historyQuery}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await otherClient.GetAsync($"/api/fields/{privateField.Id}/{historyQuery}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ownerClient.GetAsync($"/api/fields/{privateField.Id}/{historyQuery}", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.OK);
        var history = await guestClient.GetFromJsonAsync<FarmFlow.Api.Features.AgroAnalytics.GetFieldHistory.Response>(
            $"/api/fields/{guestFields[0].Id}/{historyQuery}", TestContext.Current.CancellationToken);
        history.ShouldNotBeNull();
        history.DataSource.ShouldBe("MOCK_FIXTURE");
        history.TimeSeries.Count.ShouldBeLessThanOrEqualTo(30);
        history.TimeSeries.ShouldAllBe(day => day.Date >= today.AddDays(-100) && day.Date <= today);
        (await guestClient.GetAsync($"/api/fields/{guestFields[0].Id}/history?from=bad&to=bad", TestContext.Current.CancellationToken)).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task DbSeeder_SeedsMissingDemoFieldsIdempotentlyEvenWhenUserFieldAlreadyExists()
    {
        var user = await factory.SeedUserAsync("sub-seeder", "seeder@example.com", "Seeder Farmer");
        using var authedClient = await factory.CreateAuthenticatedClientAsync(user.Id);

        var createResponse = await authedClient.PostAsJsonAsync(
            "/api/fields",
            BuildValidFieldPayload("Pre-Existing User Field"),
            TestContext.Current.CancellationToken);
        createResponse.StatusCode.ShouldBe(HttpStatusCode.Created);

        await factory.ExecuteWithDbAsync(async db =>
        {
            await DbSeeder.SeedAsync(db);
            await DbSeeder.SeedAsync(db);

            var demoCount = await db.Fields.CountAsync(f => f.IsDemo && f.OwnerId == null);
            demoCount.ShouldBe(4);
            (await db.Fields.CountAsync()).ShouldBe(5);
        });
    }

    [Fact]
    public async Task DemoLogin_CreatesIsolatedSessionSupportingFieldCreationAndLogout()
    {
        await factory.ExecuteWithDbAsync(db => DbSeeder.SeedAsync(db));

        using var demoClientA = factory.CreateClient();
        using var demoClientB = factory.CreateClient();

        var csrfA = await demoClientA.GetFromJsonAsync<GetCsrfToken.Response>(
            "/api/auth/csrf", JsonOptions, TestContext.Current.CancellationToken);
        csrfA.ShouldNotBeNull();
        demoClientA.DefaultRequestHeaders.Add(csrfA.HeaderName, csrfA.Token);

        var loginRespA = await demoClientA.PostAsync("/api/auth/demo", content: null, TestContext.Current.CancellationToken);
        loginRespA.StatusCode.ShouldBe(HttpStatusCode.OK);
        var sessionA = await loginRespA.Content.ReadFromJsonAsync<GetCurrentUser.Response>(
            JsonOptions, TestContext.Current.CancellationToken);
        sessionA.ShouldNotBeNull();
        sessionA.Authenticated.ShouldBeTrue();
        sessionA.User.ShouldNotBeNull();
        sessionA.User.DisplayName.ShouldBe("Demo Farmer");
        sessionA.User.IsDemoAccount.ShouldBeTrue();

        var authedCsrfA = await demoClientA.GetFromJsonAsync<GetCsrfToken.Response>(
            "/api/auth/csrf", JsonOptions, TestContext.Current.CancellationToken);
        authedCsrfA.ShouldNotBeNull();
        demoClientA.DefaultRequestHeaders.Remove(authedCsrfA.HeaderName);
        demoClientA.DefaultRequestHeaders.Add(authedCsrfA.HeaderName, authedCsrfA.Token);

        var createResp = await demoClientA.PostAsJsonAsync(
            "/api/fields",
            BuildValidFieldPayload("Demo Session A Private Field"),
            TestContext.Current.CancellationToken);
        createResp.StatusCode.ShouldBe(HttpStatusCode.Created);
        var created = await createResp.Content.ReadFromJsonAsync<FieldSummaryResponse>(
            JsonOptions, TestContext.Current.CancellationToken);
        created.ShouldNotBeNull();

        var csrfB = await demoClientB.GetFromJsonAsync<GetCsrfToken.Response>(
            "/api/auth/csrf", JsonOptions, TestContext.Current.CancellationToken);
        csrfB.ShouldNotBeNull();
        demoClientB.DefaultRequestHeaders.Add(csrfB.HeaderName, csrfB.Token);
        var loginRespB = await demoClientB.PostAsync("/api/auth/demo", content: null, TestContext.Current.CancellationToken);
        loginRespB.StatusCode.ShouldBe(HttpStatusCode.OK);

        var otherRead = await demoClientB.GetAsync(
            $"/api/fields/{created.Id}",
            TestContext.Current.CancellationToken);
        otherRead.StatusCode.ShouldBe(HttpStatusCode.NotFound);

        var logoutResp = await demoClientA.PostAsync("/api/auth/logout", content: null, TestContext.Current.CancellationToken);
        logoutResp.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        var meAfterLogout = await demoClientA.GetFromJsonAsync<GetCurrentUser.Response>(
            "/api/auth/me", JsonOptions, TestContext.Current.CancellationToken);
        meAfterLogout.ShouldNotBeNull();
        meAfterLogout.Authenticated.ShouldBeFalse();
    }

    private static object BuildValidFieldPayload(string name) => new
    {
        name,
        cropType = "Wheat",
        plantedAt = "2026-09-05",
        boundary = new
        {
            type = "Polygon",
            coordinates = new[]
            {
                new[]
                {
                    new[] { 30.512, 49.210 },
                    new[] { 30.528, 49.210 },
                    new[] { 30.528, 49.222 },
                    new[] { 30.512, 49.222 },
                    new[] { 30.512, 49.210 }
                }
            }
        }
    };

    private static JsonSerializerOptions CreateJsonOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        options.Converters.Add(new GeoJsonConverterFactory());
        options.Converters.Add(new JsonStringEnumConverter());
        return options;
    }
}
