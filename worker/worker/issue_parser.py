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


@dataclass
class ValidationParams:
    idea_id: str
    user_id: str
    title: str
    description: str
    industry: str
    target_market: str
    features: list[dict]


def parse_validation_issue_body(body: str) -> ValidationParams:
    """Parse a validation issue body.

    Expected format:
        **Idea ID:** `clxyz...`
        **User ID:** `clxyz...`

        | Field | Value |
        |-------|-------|
        | Title | ... |
        | Industry | ... |
        | Target Market | ... |

        ### Description

        <text>

        ### Features

        - Feature Name: description
    """
    idea_match = re.search(r"\*\*Idea ID:\*\*\s*`([^`]+)`", body)
    if not idea_match:
        raise ParseError("Could not find Idea ID in issue body")
    idea_id = idea_match.group(1)

    user_match = re.search(r"\*\*User ID:\*\*\s*`([^`]+)`", body)
    if not user_match:
        raise ParseError("Could not find User ID in issue body")
    user_id = user_match.group(1)

    def extract_table_value(field: str) -> str:
        pattern = rf"\|\s*{field}\s*\|\s*(.+?)\s*\|"
        match = re.search(pattern, body, re.IGNORECASE)
        if not match:
            raise ParseError(f"Could not find {field} in parameters table")
        return match.group(1).strip()

    title = extract_table_value("Title")
    industry = extract_table_value("Industry")
    target_market = extract_table_value("Target Market")

    desc_match = re.search(
        r"###\s*Description\s*\n\s*\n(.+?)(?=\n###|\Z)",
        body,
        re.DOTALL,
    )
    if not desc_match:
        raise ParseError("Could not find Description section")
    description = desc_match.group(1).strip()

    features: list[dict] = []
    features_match = re.search(
        r"###\s*Features\s*\n\s*\n(.+?)(?:\n---|\Z)",
        body,
        re.DOTALL,
    )
    if features_match:
        for line in features_match.group(1).strip().split("\n"):
            feat_match = re.match(r"-\s*(.+?):\s*(.+)", line.strip())
            if feat_match:
                features.append(
                    {"name": feat_match.group(1).strip(), "description": feat_match.group(2).strip()}
                )

    params = ValidationParams(
        idea_id=idea_id,
        user_id=user_id,
        title=title,
        description=description,
        industry=industry,
        target_market=target_market,
        features=features,
    )
    logger.info("validation_issue_parsed", idea_id=idea_id)
    return params


@dataclass
class RefinementParams:
    idea_id: str
    user_id: str
    title: str
    description: str
    industry: str
    target_market: str
    technologies: list[str]
    features: list[dict]
    prompt: str


def parse_refinement_issue_body(body: str) -> RefinementParams:
    """Parse a refinement issue body.

    Expected format:
        **Idea ID:** `clxyz...`
        **User ID:** `clxyz...`

        | Field | Value |
        |-------|-------|
        | Title | ... |
        | Industry | ... |
        | Target Market | ... |

        ### Description

        <text>

        ### Technologies

        tech1, tech2, tech3

        ### Features

        - Feature Name: description

        ### Refinement Prompt

        <user prompt>
    """
    idea_match = re.search(r"\*\*Idea ID:\*\*\s*`([^`]+)`", body)
    if not idea_match:
        raise ParseError("Could not find Idea ID in issue body")
    idea_id = idea_match.group(1)

    user_match = re.search(r"\*\*User ID:\*\*\s*`([^`]+)`", body)
    if not user_match:
        raise ParseError("Could not find User ID in issue body")
    user_id = user_match.group(1)

    def extract_table_value(field: str) -> str:
        pattern = rf"\|\s*{field}\s*\|\s*(.+?)\s*\|"
        match = re.search(pattern, body, re.IGNORECASE)
        if not match:
            raise ParseError(f"Could not find {field} in parameters table")
        return match.group(1).strip()

    title = extract_table_value("Title")
    industry = extract_table_value("Industry")
    target_market = extract_table_value("Target Market")

    desc_match = re.search(
        r"###\s*Description\s*\n\s*\n(.+?)(?=\n###|\Z)",
        body,
        re.DOTALL,
    )
    if not desc_match:
        raise ParseError("Could not find Description section")
    description = desc_match.group(1).strip()

    technologies: list[str] = []
    tech_match = re.search(
        r"###\s*Technologies\s*\n\s*\n(.+?)(?=\n###|\Z)",
        body,
        re.DOTALL,
    )
    if tech_match:
        technologies = [t.strip() for t in tech_match.group(1).strip().split(",") if t.strip()]

    features: list[dict] = []
    features_match = re.search(
        r"###\s*Features\s*\n\s*\n(.+?)(?=\n###|\Z)",
        body,
        re.DOTALL,
    )
    if features_match:
        for line in features_match.group(1).strip().split("\n"):
            feat_match = re.match(r"-\s*(.+?):\s*(.+)", line.strip())
            if feat_match:
                features.append(
                    {"name": feat_match.group(1).strip(), "description": feat_match.group(2).strip()}
                )

    prompt_match = re.search(
        r"###\s*Refinement Prompt\s*\n\s*\n(.+?)(?:\n---|\Z)",
        body,
        re.DOTALL,
    )
    if not prompt_match:
        raise ParseError("Could not find Refinement Prompt section")
    prompt = prompt_match.group(1).strip()

    params = RefinementParams(
        idea_id=idea_id,
        user_id=user_id,
        title=title,
        description=description,
        industry=industry,
        target_market=target_market,
        technologies=technologies,
        features=features,
        prompt=prompt,
    )
    logger.info("refinement_issue_parsed", idea_id=idea_id)
    return params
