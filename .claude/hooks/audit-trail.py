#!/usr/bin/env python3
"""PostToolUse hook: Track file writes/edits with an audit trail.

Logs every Write and Edit operation with timestamp, path, action type,
and word count. Stores last 100 entries in .claude/audit/file_history.json.

Compatible with existing token-optimization hooks.
"""

import json
import os
import sys
from datetime import datetime, timezone


def main():
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError):
        sys.exit(0)

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Only track file-modifying tools
    if tool_name not in ("Write", "Edit"):
        sys.exit(0)

    file_path = tool_input.get("file_path", "")
    if not file_path:
        sys.exit(0)

    # Determine action type
    action = "created" if tool_name == "Write" else "modified"

    # Calculate word count from content
    content = tool_input.get("content", "") or tool_input.get("new_string", "")
    word_count = len(content.split()) if content else 0

    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "file": os.path.basename(file_path),
        "path": file_path,
        "action": action,
        "word_count": word_count,
        "tool": tool_name,
    }

    # Persist to audit file
    audit_dir = os.path.join(os.path.dirname(__file__), "..", "audit")
    os.makedirs(audit_dir, exist_ok=True)
    history_file = os.path.join(audit_dir, "file_history.json")

    try:
        if os.path.exists(history_file):
            with open(history_file) as f:
                history = json.load(f)
        else:
            history = {"entries": []}

        history["entries"].append(entry)
        # Ring buffer: keep last 100 entries
        history["entries"] = history["entries"][-100:]

        with open(history_file, "w") as f:
            json.dump(history, f, indent=2)

        print(f"Tracked: {entry['file']} ({action})", file=sys.stderr)
    except Exception as e:
        print(f"Audit trail error: {e}", file=sys.stderr)

    # Always exit successfully — don't block the tool
    sys.exit(0)


if __name__ == "__main__":
    main()
