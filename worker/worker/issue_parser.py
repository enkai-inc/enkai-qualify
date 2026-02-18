"""Parse GitHub issue body into structured idea parameters."""

import re
from dataclasses import dataclass

import structlog

logger = structlog.get_logger()


@dataclass
class IdeaParams:
    idea_id: str
    user_id: str
    industry: str
    target_market: str
    complexity: str
    timeline: str
    problem_description: str


class ParseError(Exception):
    """Raised when the issue body cannot be parsed."""


def parse_issue_body(body: str) -> IdeaParams:
    """Parse the structured markdown issue body from github-service.ts.

    Expected format:
        **Idea ID:** `clxyz...`
        **User ID:** `clxyz...`

        | Field | Value |
        |-------|-------|
        | Industry | ... |
        | Target Market | ... |
        | Complexity | ... |
        | Timeline | ... |

        ### Problem Description

        <text>
    """
    # Extract Idea ID
    idea_match = re.search(r"\*\*Idea ID:\*\*\s*`([^`]+)`", body)
    if not idea_match:
        raise ParseError("Could not find Idea ID in issue body")
    idea_id = idea_match.group(1)

    # Extract User ID
    user_match = re.search(r"\*\*User ID:\*\*\s*`([^`]+)`", body)
    if not user_match:
        raise ParseError("Could not find User ID in issue body")
    user_id = user_match.group(1)

    # Extract table values
    def extract_table_value(field: str) -> str:
        pattern = rf"\|\s*{field}\s*\|\s*(.+?)\s*\|"
        match = re.search(pattern, body, re.IGNORECASE)
        if not match:
            raise ParseError(f"Could not find {field} in parameters table")
        return match.group(1).strip()

    industry = extract_table_value("Industry")
    target_market = extract_table_value("Target Market")
    complexity = extract_table_value("Complexity")
    timeline = extract_table_value("Timeline")

    # Extract Problem Description section
    problem_match = re.search(
        r"###\s*Problem Description\s*\n\s*\n(.+?)(?:\n---|\Z)",
        body,
        re.DOTALL,
    )
    if not problem_match:
        raise ParseError("Could not find Problem Description section")
    problem_description = problem_match.group(1).strip()

    params = IdeaParams(
        idea_id=idea_id,
        user_id=user_id,
        industry=industry,
        target_market=target_market,
        complexity=complexity,
        timeline=timeline,
        problem_description=problem_description,
    )
    logger.info("issue_parsed", idea_id=idea_id, industry=industry)
    return params
