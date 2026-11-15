namespace FarmFlow.Api.Infrastructure.Weather;

public sealed class WeatherForecastSettings
{
    public const string SectionName = "WeatherForecast";

    public bool Enabled { get; set; } = true;
    public string BaseUrl { get; set; } = "https://api.open-meteo.com/v1/forecast";
    public double TimeoutSeconds { get; set; } = 3.0;
    public int CacheMinutes { get; set; } = 60;
}
