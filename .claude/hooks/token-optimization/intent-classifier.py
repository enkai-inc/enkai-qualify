#!/usr/bin/env python3
"""
Intent Classifier for Progressive Context Loading

Classifies task complexity from user prompts and skill invocations into 5 levels
to enable progressive context loading. Uses keyword/pattern matching (no ML deps).

Levels:
  ultra_light (100-500 tokens)   -- progress checks, status queries
  light       (500-2K tokens)    -- typo fix, small config change
  medium      (2-5K tokens)      -- bug fix, single feature
  heavy       (5-20K tokens)     -- large feature, refactor
  ultra_heavy (20K+ tokens)      -- system redesign, multi-file overhaul

Usage:
  from intent_classifier import classify_intent
  result = classify_intent("/scrum status")
  # => {'level': 'ultra_light', 'token_budget': 300, 'description': '...'}
"""

import re
from typing import Dict, Union

# ---------------------------------------------------------------------------
# Intent level definitions
# ---------------------------------------------------------------------------

INTENT_LEVELS: Dict[str, Dict[str, Union[str, int]]] = {
    "ultra_light": {
        "token_budget": 300,
        "description": "Progress check or status query",
    },
    "light": {
        "token_budget": 1500,
        "description": "Small change such as typo fix or config tweak",
    },
    "medium": {
        "token_budget": 4000,
        "description": "Bug fix or single feature implementation",
    },
    "heavy": {
        "token_budget": 15000,
        "description": "Large feature or multi-file refactor",
    },
    "ultra_heavy": {
        "token_budget": 30000,
        "description": "System redesign or architecture overhaul",
    },
}

# ---------------------------------------------------------------------------
# Pattern banks -- order matters: first match wins within each level
# ---------------------------------------------------------------------------

# Ultra-light: status / progress / trivial queries
_ULTRA_LIGHT_PATTERNS = [
    r"(?:^|/)status\b",
    r"\bprogress\b",
    r"\bcheck\s+(?:status|progress|build|ci)\b",
    r"\bhow.s it going\b",
    r"\bwhat.s the (?:status|state|progress)\b",
    r"\bping\b",
    r"\bheartbeat\b",
    r"\buptime\b",
    r"^version$",
    r"\bcheck\s+version\b",
    r"\bwhich branch\b",
]

# Light: small fixes, typos, single-line edits
_LIGHT_PATTERNS = [
    r"\btypo\b",
    r"\brename\b",
    r"\bspelling\b",
    r"\bformat(?:ting)?\b",
    r"\blint\b",
    r"\bcleanup\b",
    r"\bclean[\s-]?up\b",
    r"\bremove unused\b",
    r"\bupdate (?:version|dep|dependency)\b",
    r"\bbump\b",
    r"\bimport\s+(?:fix|sort|order)\b",
    r"\bwhitespace\b",
    r"\bindent(?:ation)?\b",
    r"\bcomment\b",
    r"\bdoc(?:string)?\s+(?:fix|update|add)\b",
]

# Heavy: large features, refactors, multi-file work
_HEAVY_PATTERNS = [
    r"\brefactor\b",
    r"\bmigrat(?:e|ion)\b",
    r"\brewrite\b",
    r"\breorganiz(?:e|ation)\b",
    r"\bmulti[\s-]?file\b",
    r"\boverhaul\b",
    r"\bintegrat(?:e|ion)\b",
    r"\bpipeline\b",
    r"\binfrastructure\b",
    r"\bcross[\s-]?cutting\b",
    r"/build\b",
    r"/scrum\b",
    r"/feature-dev\b",
]

# Ultra-heavy: system-wide redesign, architecture
_ULTRA_HEAVY_PATTERNS = [
    r"\bredesign\b",
    r"\barchitecture\b",
    r"\bsystem[\s-]?wide\b",
    r"\bfull[\s-]?rewrite\b",
    r"\bplatform\b",
    r"\bmonorepo\b",
    r"\bmicroservice\b",
    r"\bfrom[\s-]?scratch\b",
]

# Medium-level skills (explicit skill matches)
_MEDIUM_SKILL_PATTERNS = [
    r"/eval\b",
    r"/bug\b",
    r"/tdd",
    r"/dd\b",
    r"/design\b",
    r"/plan\b",
    r"/execute\b",
    r"/idea\b",
    r"/code-review\b",
    r"/observatory\b",
    r"/mcp-builder\b",
    r"/confidence-check\b",
    r"/correct-course\b",
    r"/gh-triage\b",
]


def _matches_any(text: str, patterns: list) -> bool:
    """Return True if text matches any pattern in the list."""
    for pattern in patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    return False


def classify_intent(prompt: str) -> Dict[str, Union[str, int]]:
    """
    Classify the complexity of a task from its prompt text.

    Args:
        prompt: The user prompt or skill invocation string.

    Returns:
        Dict with keys:
          - level: one of ultra_light, light, medium, heavy, ultra_heavy
          - token_budget: suggested token budget for context loading
          - description: human-readable description of the level
    """
    if not prompt or not prompt.strip():
        return {
            "level": "medium",
            "token_budget": INTENT_LEVELS["medium"]["token_budget"],
            "description": INTENT_LEVELS["medium"]["description"],
        }

    text = prompt.strip()

    # Check from most extreme levels inward, but explicit skill invocations
    # take priority over keyword heuristics within the same band.
    if _matches_any(text, _ULTRA_HEAVY_PATTERNS):
        level = "ultra_heavy"
    elif _matches_any(text, _ULTRA_LIGHT_PATTERNS):
        level = "ultra_light"
    elif _matches_any(text, _MEDIUM_SKILL_PATTERNS):
        level = "medium"
    elif _matches_any(text, _LIGHT_PATTERNS):
        level = "light"
    elif _matches_any(text, _HEAVY_PATTERNS):
        level = "heavy"
    else:
        # Heuristic: longer prompts tend to describe bigger tasks
        word_count = len(text.split())
        if word_count <= 5:
            level = "light"
        elif word_count <= 30:
            level = "medium"
        else:
            level = "heavy"

    return {
        "level": level,
        "token_budget": INTENT_LEVELS[level]["token_budget"],
        "description": INTENT_LEVELS[level]["description"],
    }


def get_intent_levels() -> Dict[str, Dict[str, Union[str, int]]]:
    """Return the full intent levels configuration dict."""
    return dict(INTENT_LEVELS)
