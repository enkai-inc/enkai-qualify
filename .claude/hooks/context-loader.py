#!/usr/bin/env python3
"""Context loader hook for mode-based context switching.

Maps skills to their required context mode (dev, research, review) and
injects the appropriate behavioral rules. This reduces per-session token
usage by ~30-40% compared to loading all behavioral rules from CLAUDE.md.

Triggered by skill invocation patterns in hooks.json.
"""

import json
import os
import re
import sys

# Skill-to-context-mode mapping.
# Skills not listed here default to 'dev' mode.
SKILL_CONTEXT_MAP = {
    # Development mode — implementation focus
    "eval": "dev",
    "build": "dev",
    "bug": "dev",
    "execute": "dev",
    "feature-dev": "dev",
    "tdd-discipline": "dev",
    "deploy": "dev",
    "mcp-builder": "dev",
    "maint": "dev",
    "deps": "dev",
    "rollback": "dev",
    "clean": "dev",
    # Research mode — exploration focus
    "dd": "research",
    "design": "research",
    "idea": "research",
    "observatory": "research",
    "plan": "research",
    "confidence-check": "research",
    # Review mode — analysis focus
    "code-review": "review",
    "critic": "review",
    "checker": "review",
    "verify": "review",
    "gh-triage": "review",
    "correct-course": "review",
    "judge-with-debate": "review",
    "contract-review": "review",
    "do-competitively": "review",
}

DEFAULT_MODE = "dev"


def get_context_mode(tool_input: str) -> str | None:
    """Extract context mode from a skill invocation command.

    Looks for /skill-name patterns in the tool input and maps
    to the appropriate context mode.
    """
    # Match slash-command patterns like /eval, /build, /dd
    match = re.search(r"/([a-z][a-z0-9-]*)", tool_input)
    if not match:
        return None

    skill_name = match.group(1)
    return SKILL_CONTEXT_MAP.get(skill_name, DEFAULT_MODE)


def load_context_file(mode: str) -> str | None:
    """Load the context file for the given mode."""
    # Resolve relative to this script's location
    script_dir = os.path.dirname(os.path.abspath(__file__))
    contexts_dir = os.path.join(os.path.dirname(script_dir), "contexts")
    context_path = os.path.join(contexts_dir, f"{mode}.md")

    if not os.path.isfile(context_path):
        return None

    with open(context_path, "r") as f:
        return f.read().strip()


def main():
    """Read hook input from stdin and output context decision."""
    try:
        hook_input = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, EOFError):
        # If we cannot parse input, allow without modification
        print(json.dumps({"decision": "allow"}))
        return

    tool_input = hook_input.get("tool_input", {})

    # Handle both string and dict tool_input formats
    if isinstance(tool_input, dict):
        command = tool_input.get("command", "")
    else:
        command = str(tool_input)

    mode = get_context_mode(command)
    if mode is None:
        # Not a skill invocation — allow without context injection
        print(json.dumps({"decision": "allow"}))
        return

    context_content = load_context_file(mode)
    if context_content is None:
        # Context file not found — allow without modification
        print(json.dumps({"decision": "allow"}))
        return

    # Emit context as a message to the agent via stderr for logging,
    # and allow the command to proceed
    sys.stderr.write(f"[context-loader] Activated '{mode}' mode\n")
    print(json.dumps({
        "decision": "allow",
        "message": f"Context mode: {mode}\n\n{context_content}",
    }))


if __name__ == "__main__":
    main()
