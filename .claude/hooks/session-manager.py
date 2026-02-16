#!/usr/bin/env python3
"""Session lifecycle hooks: start, end, and pre-compact state persistence.

Tracks session metrics (duration, files modified, tools used) and persists
state for continuity across context compactions and session restarts.

Hook events handled:
- PostToolUse (Write/Edit): Increment file modification counter
- Can be extended for SessionStart/SessionEnd when supported
"""

import json
import os
import re
import sys
from datetime import datetime, timezone


SESSION_DIR = os.path.join(os.path.dirname(__file__), "..", "session")
STATE_FILE = os.path.join(SESSION_DIR, "current_state.json")


def load_state():
    """Load or initialize session state."""
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            return json.load(f)
    return {
        "session_id": datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S"),
        "started_at": datetime.now(timezone.utc).isoformat(),
        "metrics": {
            "files_modified": 0,
            "tools_used": {},
            "decisions": [],
        },
        "context": {
            "last_task": None,
            "working_branch": None,
            "open_issues": [],
        },
    }


def save_state(state):
    """Persist session state."""
    os.makedirs(SESSION_DIR, exist_ok=True)
    state["last_updated"] = datetime.now(timezone.utc).isoformat()
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


def handle_tool_use(input_data):
    """Track tool usage metrics."""
    tool_name = input_data.get("tool_name", "")
    if not tool_name:
        return

    state = load_state()

    # Increment tool usage counter
    tools = state["metrics"]["tools_used"]
    tools[tool_name] = tools.get(tool_name, 0) + 1

    # Track file modifications
    if tool_name in ("Write", "Edit"):
        state["metrics"]["files_modified"] += 1
        file_path = input_data.get("tool_input", {}).get("file_path", "")
        if file_path:
            state["context"]["last_task"] = f"Modified {os.path.basename(file_path)}"

    # Track branch context
    if tool_name == "Bash":
        cmd = input_data.get("tool_input", {}).get("command", "")
        if "git checkout" in cmd or "git switch" in cmd:
            match = re.search(
                r"(?:checkout|switch)\s+(?:-[bB]\s+)?(\S+)", cmd
            )
            if match:
                branch = match.group(1)
                if not branch.startswith("-"):
                    state["context"]["working_branch"] = branch

    save_state(state)


def generate_summary():
    """Generate session summary for context compaction."""
    state = load_state()
    metrics = state["metrics"]

    summary = {
        "session_id": state["session_id"],
        "started_at": state["started_at"],
        "duration_estimate": "See last_updated - started_at",
        "files_modified": metrics["files_modified"],
        "top_tools": sorted(
            metrics["tools_used"].items(),
            key=lambda x: x[1],
            reverse=True,
        )[:5],
        "last_task": state["context"]["last_task"],
        "working_branch": state["context"]["working_branch"],
    }

    os.makedirs(SESSION_DIR, exist_ok=True)
    summary_file = os.path.join(SESSION_DIR, "session_summary.json")
    with open(summary_file, "w") as f:
        json.dump(summary, f, indent=2)

    return summary


def main():
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError):
        sys.exit(0)

    try:
        handle_tool_use(input_data)
    except Exception as e:
        print(f"Session manager error: {e}", file=sys.stderr)

    # Always exit successfully
    sys.exit(0)


if __name__ == "__main__":
    main()
