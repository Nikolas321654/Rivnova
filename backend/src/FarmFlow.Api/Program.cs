using System.Text.Json.Serialization;
using FarmFlow.Api.Features.AgroAnalytics;
using FarmFlow.Api.Features.Alerts;
using FarmFlow.Api.Features.Auth;
using FarmFlow.Api.Features.Fields;
using FarmFlow.Api.Features.Predictions;
using FarmFlow.Api.Features.System;
using FarmFlow.Api.Features.Users;
using FarmFlow.Api.Infrastructure.Auth;
using FarmFlow.Api.Infrastructure.Database;
using FarmFlow.Api.Infrastructure.Ml;
using FarmFlow.Api.Infrastructure.Nasa;
using FarmFlow.Api.Infrastructure.Weather;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.IO.Converters;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new GeoJsonConverterFactory());
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        npgsql => npgsql.UseNetTopologySuite()));

builder.Services.AddMemoryCache();
builder.Services.AddHybridCache();
builder.Services.Configure<NasaSettings>(builder.Configuration.GetSection(NasaSettings.SectionName));
builder.Services.AddHttpClient<NasaPowerClient>();
builder.Services.Configure<WeatherForecastSettings>(builder.Configuration.GetSection(WeatherForecastSettings.SectionName));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddHttpClient<OpenMeteoForecastClient>();
builder.Services.AddScoped<IPrecipitationForecastClient, CachedPrecipitationForecastClient>();

builder.Services.AddFarmFlowAuth(builder.Configuration);
builder.Services.AddOpenApi();

var allowedOrigins = (builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? ["http://localhost:5173", "http://localhost:3000"])
    .Where(origin => !string.IsNullOrWhiteSpace(origin) && origin != "*")
    .ToArray();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddSingleton<INasaFixtureStore, FileNasaFixtureStore>();
builder.Services.AddSingleton<MockNasaClient>();
builder.Services.AddScoped<INasaClient, ResilientNasaClient>();

builder.Services.AddSingleton<OnnxModelRegistry>();

var app = builder.Build();

app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(options =>
    {
        options.WithTitle("FarmFlow NASA API")
               .WithTheme(ScalarTheme.Moon);
    });
}

await app.InitializeDatabaseAsync();

app.MapSystemEndpoints();
app.MapAuthEndpoints();
app.MapUsersEndpoints();
app.MapFieldsEndpoints();
app.MapAgroAnalyticsEndpoints();
app.MapPredictionsEndpoints();
app.MapAlertsEndpoints();

await app.RunAsync();

public partial class Program
{
    protected Program() { }
}
