"""Tests for opportunity pattern detection."""
from api.src.services.discovery.patterns import (
    DetectedOpportunity,
    OpportunityDetector,
    OpportunityType,
)


class TestOpportunityType:
    """Tests for OpportunityType enum."""

    def test_opportunity_types_exist(self) -> None:
        """Test all expected opportunity types exist."""
        assert OpportunityType.ALTERNATIVE == "alternative"
        assert OpportunityType.BEST_FOR == "best_for"
        assert OpportunityType.HOW_TO == "how_to"
        assert OpportunityType.COMPARISON == "comparison"
        assert OpportunityType.CATEGORY == "category"


class TestDetectedOpportunity:
    """Tests for DetectedOpportunity model."""

    def test_detected_opportunity_creation(self) -> None:
        """Test creating a DetectedOpportunity instance."""
        opp = DetectedOpportunity(
            keyword="alternative to slack",
            opportunity_type=OpportunityType.ALTERNATIVE,
            extracted_entities={"competitor": "slack"},
            confidence=0.9,
        )
        assert opp.keyword == "alternative to slack"
        assert opp.opportunity_type == OpportunityType.ALTERNATIVE
        assert opp.extracted_entities == {"competitor": "slack"}
        assert opp.confidence == 0.9


class TestOpportunityDetector:
    """Tests for OpportunityDetector pattern matching."""

    def test_detect_alternative(self) -> None:
        """Test detecting alternative pattern."""
        detector = OpportunityDetector()
        result = detector.detect("alternative to slack")

        assert result is not None
        assert result.opportunity_type == OpportunityType.ALTERNATIVE
        assert result.extracted_entities == {"competitor": "slack"}
        assert result.confidence == 0.9

    def test_detect_alternatives_plural(self) -> None:
        """Test detecting alternatives (plural) pattern."""
        detector = OpportunityDetector()
        result = detector.detect("alternatives to notion")

        assert result is not None
        assert result.opportunity_type == OpportunityType.ALTERNATIVE
        assert result.extracted_entities == {"competitor": "notion"}

    def test_detect_best_for(self) -> None:
        """Test detecting best-for pattern."""
        detector = OpportunityDetector()
        result = detector.detect("best crm for startups")

        assert result is not None
        assert result.opportunity_type == OpportunityType.BEST_FOR
        assert result.extracted_entities == {"product": "crm", "niche": "startups"}
        assert result.confidence == 0.9

    def test_detect_how_to(self) -> None:
        """Test detecting how-to pattern."""
        detector = OpportunityDetector()
        result = detector.detect("how to manage projects")

        assert result is not None
        assert result.opportunity_type == OpportunityType.HOW_TO
        assert result.extracted_entities == {"problem": "manage projects"}
        assert result.confidence == 0.9

    def test_detect_comparison(self) -> None:
        """Test detecting comparison pattern."""
        detector = OpportunityDetector()
        result = detector.detect("notion vs asana")

        assert result is not None
        assert result.opportunity_type == OpportunityType.COMPARISON
        expected = {"product_a": "notion", "product_b": "asana"}
        assert result.extracted_entities == expected
        assert result.confidence == 0.9

    def test_detect_category(self) -> None:
        """Test detecting category pattern."""
        detector = OpportunityDetector()
        result = detector.detect("project management software")

        assert result is not None
        assert result.opportunity_type == OpportunityType.CATEGORY
        assert result.extracted_entities == {"category": "project management"}
        assert result.confidence == 0.9

    def test_detect_category_with_tool(self) -> None:
        """Test detecting category pattern with 'tool' suffix."""
        detector = OpportunityDetector()
        result = detector.detect("email marketing tool")

        assert result is not None
        assert result.opportunity_type == OpportunityType.CATEGORY
        assert result.extracted_entities == {"category": "email marketing"}

    def test_detect_no_match(self) -> None:
        """Test that non-matching keywords return None."""
        detector = OpportunityDetector()
        result = detector.detect("random search query")

        assert result is None

    def test_detect_batch(self) -> None:
        """Test batch detection of opportunities."""
        detector = OpportunityDetector()
        keywords = [
            "alternative to slack",
            "best crm for startups",
            "random query",
            "notion vs asana",
        ]
        results = detector.detect_batch(keywords)

        assert len(results) == 3  # 'random query' should not match
        types = [r.opportunity_type for r in results]
        assert OpportunityType.ALTERNATIVE in types
        assert OpportunityType.BEST_FOR in types
        assert OpportunityType.COMPARISON in types

    def test_case_insensitive(self) -> None:
        """Test pattern matching is case insensitive."""
        detector = OpportunityDetector()

        result1 = detector.detect("Alternative To Slack")
        result2 = detector.detect("BEST CRM FOR STARTUPS")

        assert result1 is not None
        assert result1.opportunity_type == OpportunityType.ALTERNATIVE

        assert result2 is not None
        assert result2.opportunity_type == OpportunityType.BEST_FOR
