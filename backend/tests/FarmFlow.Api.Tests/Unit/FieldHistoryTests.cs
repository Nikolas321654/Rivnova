using FarmFlow.Api.Features.AgroAnalytics;
using Shouldly;
using Xunit;

namespace FarmFlow.Api.Tests.Unit;

public class FieldHistoryTests
{
    [Theory]
    [InlineData("2026-05-01", "2026-11-15", true)]
    [InlineData("2025-11-15", "2026-11-15", true)]
    [InlineData("2025-11-14", "2026-11-15", false)]
    [InlineData("2026-11-16", "2026-11-17", false)]
    [InlineData("2026-11-15", "2026-05-01", false)]
    [InlineData("bad", "2026-11-15", false)]
    [InlineData("2026-02-30", "2026-11-15", false)]
    public void ValidatesDates(string from, string to, bool valid)
    {
        GetFieldHistory.ValidRange(from, to, new DateOnly(2026, 11, 15), out _, out _).ShouldBe(valid);
    }
}
