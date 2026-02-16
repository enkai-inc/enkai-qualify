#!/usr/bin/env python3
"""Tests for the context-loader hook."""

import json
import os
import subprocess
import sys

HOOK_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "context-loader.py",
)
CONTEXTS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "contexts",
)


def run_hook(tool_input: dict | str) -> dict:
    """Run the context-loader hook with the given tool input and return parsed output."""
    hook_input = json.dumps({"tool_input": tool_input})
    result = subprocess.run(
        [sys.executable, HOOK_PATH],
        input=hook_input,
        capture_output=True,
        text=True,
        cwd=os.path.dirname(HOOK_PATH),
    )
    return json.loads(result.stdout.strip())


def test_dev_mode_skills():
    """Skills like /eval, /build, /bug should activate dev mode."""
    for skill in ["eval", "build", "bug", "execute", "feature-dev", "tdd-discipline"]:
        result = run_hook({"command": f"/{skill} 123"})
        assert result["decision"] == "allow", f"/{skill} should be allowed"
        assert "dev" in result.get("message", "").lower() or "Development Mode" in result.get("message", ""), (
            f"/{skill} should activate dev mode, got: {result.get('message', '')[:80]}"
        )


def test_research_mode_skills():
    """Skills like /dd, /design, /idea should activate research mode."""
    for skill in ["dd", "design", "idea", "observatory", "plan", "confidence-check"]:
        result = run_hook({"command": f"/{skill} topic"})
        assert result["decision"] == "allow", f"/{skill} should be allowed"
        assert "Research Mode" in result.get("message", ""), (
            f"/{skill} should activate research mode, got: {result.get('message', '')[:80]}"
        )


def test_review_mode_skills():
    """Skills like /code-review, /critic should activate review mode."""
    for skill in ["code-review", "critic", "checker", "gh-triage", "correct-course", "contract-review", "judge-with-debate", "do-competitively"]:
        result = run_hook({"command": f"/{skill}"})
        assert result["decision"] == "allow", f"/{skill} should be allowed"
        assert "Review Mode" in result.get("message", ""), (
            f"/{skill} should activate review mode, got: {result.get('message', '')[:80]}"
        )


def test_non_skill_command():
    """Non-skill commands should pass through without context injection."""
    result = run_hook({"command": "git status"})
    assert result["decision"] == "allow"
    assert "message" not in result, "Non-skill commands should not inject context"


def test_unknown_skill_defaults_to_dev():
    """Unknown skills should default to dev mode."""
    result = run_hook({"command": "/unknown-skill"})
    assert result["decision"] == "allow"
    assert "Development Mode" in result.get("message", ""), (
        f"Unknown skills should default to dev mode, got: {result.get('message', '')[:80]}"
    )


def test_invalid_json_input():
    """Invalid JSON input should return allow without error."""
    result = subprocess.run(
        [sys.executable, HOOK_PATH],
        input="not json",
        capture_output=True,
        text=True,
        cwd=os.path.dirname(HOOK_PATH),
    )
    output = json.loads(result.stdout.strip())
    assert output["decision"] == "allow"


def test_context_files_exist():
    """All three context files should exist."""
    for mode in ["dev", "research", "review"]:
        path = os.path.join(CONTEXTS_DIR, f"{mode}.md")
        assert os.path.isfile(path), f"Context file missing: {path}"


def test_context_files_are_compact():
    """Context files should be compact (under 200 lines each)."""
    for mode in ["dev", "research", "review"]:
        path = os.path.join(CONTEXTS_DIR, f"{mode}.md")
        with open(path, "r") as f:
            lines = f.readlines()
        assert len(lines) < 200, f"{mode}.md has {len(lines)} lines, expected < 200"


def test_string_tool_input():
    """String tool_input should be handled gracefully."""
    result = run_hook("/eval 42")
    assert result["decision"] == "allow"
    assert "Development Mode" in result.get("message", ""), (
        "String tool_input with /eval should activate dev mode"
    )


if __name__ == "__main__":
    tests = [
        test_dev_mode_skills,
        test_research_mode_skills,
        test_review_mode_skills,
        test_non_skill_command,
        test_unknown_skill_defaults_to_dev,
        test_invalid_json_input,
        test_context_files_exist,
        test_context_files_are_compact,
        test_string_tool_input,
    ]
    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            print(f"  PASS: {test.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"  FAIL: {test.__name__}: {e}")
            failed += 1
        except Exception as e:
            print(f"  ERROR: {test.__name__}: {e}")
            failed += 1
    print(f"\n{passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)
