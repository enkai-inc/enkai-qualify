"""Impact calculator for RICE scoring."""
from src.services.discovery.patterns import OpportunityType

TYPE_BOOSTS = {
    OpportunityType.ALTERNATIVE: 1.5,
    OpportunityType.COMPARISON: 1.2,
    OpportunityType.BEST_FOR: 1.0,
    OpportunityType.CATEGORY: 0.8,
    OpportunityType.HOW_TO: 0.6,
}

CPC_THRESHOLDS = [
    (10.0, 3.0),
    (5.0, 2.0),
    (2.0, 1.0),
    (1.0, 0.5),
    (0.0, 0.25),
]


def calculate_impact(
    cpc: float, opportunity_type: OpportunityType | None = None
) -> tuple[float, str]:
    """Calculate impact score from CPC and opportunity type."""
    base_impact = 0.25
    for threshold, impact in CPC_THRESHOLDS:
        if cpc >= threshold:
            base_impact = impact
            break

    boost = TYPE_BOOSTS.get(opportunity_type, 1.0) if opportunity_type else 1.0
    final_impact = min(base_impact * boost, 3.0)

    type_name = opportunity_type.value if opportunity_type else "general"
    reasoning = f"CPC ${cpc:.2f}, {type_name} pattern"
    if boost != 1.0:
        reasoning += f" ({boost:.1f}x boost)"

    return round(final_impact, 2), reasoning
