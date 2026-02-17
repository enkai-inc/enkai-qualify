"""Reach calculator for RICE scoring."""
import math

GEO_MULTIPLIERS = {
    "global": 1.0,
    "us": 0.85,
    "uk": 0.6,
    "eu": 0.7,
    "regional": 0.4,
}


def calculate_reach(volume: int, geo: str = "global") -> tuple[float, str]:
    """Calculate normalized reach from search volume.

    Args:
        volume: Monthly search volume.
        geo: Geographic focus (global, us, uk, eu, regional).

    Returns:
        Tuple of (normalized_reach, reasoning_string).
    """
    if volume <= 0:
        return 0.0, "No search volume data"

    multiplier = GEO_MULTIPLIERS.get(geo.lower(), 1.0)
    normalized = math.log10(volume + 1) * 100 * multiplier

    reasoning = f"{volume:,} monthly searches"
    if geo != "global":
        reasoning += f" ({geo.upper()} focused, {multiplier:.0%} multiplier)"

    return round(normalized, 2), reasoning
