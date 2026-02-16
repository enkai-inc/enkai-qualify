"""Discovery services for keyword-based opportunity finding."""
from .dataforseo import DataForSEOClient, KeywordData
from .engine import DiscoveryEngine, DiscoveryResult
from .patterns import DetectedOpportunity, OpportunityDetector, OpportunityType

__all__ = [
    "DataForSEOClient",
    "KeywordData",
    "OpportunityDetector",
    "OpportunityType",
    "DetectedOpportunity",
    "DiscoveryEngine",
    "DiscoveryResult",
]
