"""Tests for DataForSEO client."""
import pytest
from api.src.services.discovery.dataforseo import DataForSEOClient, KeywordData


class TestKeywordData:
    """Tests for KeywordData model."""

    def test_keyword_data_creation(self) -> None:
        """Test creating a KeywordData instance."""
        data = KeywordData(
            keyword="test keyword",
            search_volume=1000,
            competition=0.5,
            cpc=2.50,
            trend="stable",
        )
        assert data.keyword == "test keyword"
        assert data.search_volume == 1000
        assert data.competition == 0.5
        assert data.cpc == 2.50
        assert data.trend == "stable"

    def test_keyword_data_trend_values(self) -> None:
        """Test valid trend values."""
        for trend in ["rising", "stable", "declining"]:
            data = KeywordData(
                keyword="test",
                search_volume=100,
                competition=0.1,
                cpc=1.0,
                trend=trend,
            )
            assert data.trend == trend


class TestDataForSEOClient:
    """Tests for DataForSEO API client."""

    def test_client_initialization(self) -> None:
        """Test client initializes correctly."""
        client = DataForSEOClient()
        assert client.base_url == "https://api.dataforseo.com/v3"

    @pytest.mark.asyncio
    async def test_get_keyword_data_mock(self) -> None:
        """Test getting keyword data returns mock data without credentials."""
        client = DataForSEOClient()
        # Without credentials, should return mock data
        keywords = ["test keyword", "another keyword"]
        results = await client.get_keyword_data(keywords)

        assert len(results) == 2
        assert all(isinstance(r, KeywordData) for r in results)
        assert results[0].keyword == "test keyword"
        assert results[0].search_volume == 1000
        assert results[0].competition == 0.5
        assert results[0].cpc == 2.50
        assert results[0].trend == "stable"

    @pytest.mark.asyncio
    async def test_get_related_keywords_mock(self) -> None:
        """Test getting related keywords returns mock data without credentials."""
        client = DataForSEOClient()
        results = await client.get_related_keywords("project management")

        assert len(results) == 3
        assert "project management software" in results
        assert "best project management" in results
        assert "project management alternative" in results

    def test_detect_trend_rising(self) -> None:
        """Test trend detection for rising keywords."""
        client = DataForSEOClient()
        monthly = [
            {"search_volume": 1500},
            {"search_volume": 1400},
            {"search_volume": 1300},
            {"search_volume": 1000},
            {"search_volume": 900},
            {"search_volume": 800},
        ]
        assert client._detect_trend(monthly) == "rising"

    def test_detect_trend_declining(self) -> None:
        """Test trend detection for declining keywords."""
        client = DataForSEOClient()
        monthly = [
            {"search_volume": 500},
            {"search_volume": 600},
            {"search_volume": 700},
            {"search_volume": 1000},
            {"search_volume": 1100},
            {"search_volume": 1200},
        ]
        assert client._detect_trend(monthly) == "declining"

    def test_detect_trend_stable(self) -> None:
        """Test trend detection for stable keywords."""
        client = DataForSEOClient()
        monthly = [
            {"search_volume": 1000},
            {"search_volume": 1000},
            {"search_volume": 1000},
            {"search_volume": 1000},
            {"search_volume": 1000},
            {"search_volume": 1000},
        ]
        assert client._detect_trend(monthly) == "stable"

    def test_detect_trend_empty(self) -> None:
        """Test trend detection with empty data."""
        client = DataForSEOClient()
        assert client._detect_trend([]) == "stable"
        assert client._detect_trend([{"search_volume": 100}]) == "stable"
