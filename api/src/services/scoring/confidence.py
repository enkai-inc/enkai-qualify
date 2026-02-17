"""Confidence calculator for RICE scoring."""

TREND_CONFIDENCE = {
    "rising": 1.0,
    "stable": 0.8,
    "mixed": 0.5,
    "declining": 0.25,
}


def calculate_confidence(
    trend: str,
    pattern_confidence: float = 1.0,
    data_age_days: int = 0,
) -> tuple[float, str]:
    """Calculate confidence score from trend and pattern match."""
    trend_lower = trend.lower()
    base_confidence = TREND_CONFIDENCE.get(trend_lower, 0.5)

    pattern_weight = max(pattern_confidence, 0.5)
    confidence = base_confidence * pattern_weight

    if data_age_days > 90:
        confidence *= 0.7
        freshness = "stale"
    elif data_age_days > 30:
        confidence *= 0.9
        freshness = "recent"
    else:
        freshness = "fresh"

    factors = [f"{trend_lower} trend"]
    if pattern_confidence < 1.0:
        factors.append(f"{pattern_confidence:.0%} pattern match")
    if data_age_days > 30:
        factors.append(f"{freshness} data ({data_age_days}d)")

    reasoning = ", ".join(factors)
    return round(min(confidence, 1.0), 2), reasoning
