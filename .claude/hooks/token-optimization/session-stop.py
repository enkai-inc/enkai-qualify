#!/usr/bin/env python3
"""
Session Stop Hook

Generates a session summary and captures handoff metadata when a Claude Code
session ends. Designed to run as a Stop lifecycle hook.

Features:
  - Session summary: tokens used, compactions performed, cache hits
  - Handoff metadata: written to .claude/artifacts/handoffs/ if dir exists
  - Stats persistence: session stats to state dir for cross-session tracking

Usage:
  Called as a Stop hook at session end.
  python session-stop.py              # Run stop hook (hook mode)
  python session-stop.py --status     # Report session history
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

# Import shared config loader
sys.path.insert(0, str(Path(__file__).parent))
from config_loader import get_project_dir, get_state_dir


def _read_json_file(path: Path) -> Dict[str, Any]:
    """Read and parse a JSON file, returning empty dict on failure."""
    if not path.exists():
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError, OSError) as e:
        print(f"session-stop: failed to read {path.name}: {e}", file=sys.stderr)
        return {}


def generate_session_summary() -> Dict[str, Any]:
    """
    Generate a session summary including token usage, compaction stats, and cache info.

    Returns:
        Dictionary with session_end timestamp, compaction_stats, and cache_stats.
    """
    now = datetime.now(timezone.utc).isoformat()

    # Read persisted compaction stats
    compaction_stats = {"total_compactions": 0, "total_tokens_saved": 0, "total_original_tokens": 0}
    try:
        state_dir = get_state_dir()
        stats_file = state_dir / "compaction_stats.json"
        persisted = _read_json_file(stats_file)
        if persisted:
            compaction_stats["total_compactions"] = persisted.get("total_compactions", 0)
            compaction_stats["total_tokens_saved"] = persisted.get("total_tokens_saved", 0)
            compaction_stats["total_original_tokens"] = persisted.get("total_original_tokens", 0)
    except (IOError, OSError) as e:
        print(f"session-stop: failed to read compaction stats: {e}", file=sys.stderr)

    # Read cache stats if available
    cache_stats = {"hits": 0, "misses": 0}
    try:
        state_dir = get_state_dir()
        cache_file = state_dir / "atlas_cache_stats.json"
        cached = _read_json_file(cache_file)
        if cached:
            cache_stats["hits"] = cached.get("hits", 0)
            cache_stats["misses"] = cached.get("misses", 0)
    except (IOError, OSError) as e:
        print(f"session-stop: failed to read cache stats: {e}", file=sys.stderr)

    return {
        "session_end": now,
        "compaction_stats": compaction_stats,
        "cache_stats": cache_stats,
    }


def capture_handoff_metadata() -> bool:
    """
    Capture handoff metadata to .claude/artifacts/handoffs/ if the directory exists.

    Returns:
        True if handoff was written, False if skipped (no artifacts dir).
    """
    try:
        project_dir = get_project_dir()
    except (IOError, OSError) as e:
        print(f"session-stop: failed to get project dir: {e}", file=sys.stderr)
        return False

    handoffs_dir = project_dir / ".claude" / "artifacts" / "handoffs"
    if not handoffs_dir.is_dir():
        return False

    summary = generate_session_summary()
    now = datetime.now(timezone.utc)
    filename = f"handoff-{now.strftime('%Y%m%dT%H%M%SZ')}.json"

    handoff_data = {
        "session_end": summary["session_end"],
        "summary": summary,
        "handoff_type": "session_stop",
    }

    try:
        handoff_path = handoffs_dir / filename
        with open(handoff_path, "w", encoding="utf-8") as f:
            json.dump(handoff_data, f, indent=2)
        return True
    except (IOError, OSError) as e:
        print(f"session-stop: failed to write handoff metadata: {e}", file=sys.stderr)
        return False


def persist_session_stats() -> None:
    """
    Write session stats to the state dir for cross-session tracking.

    Appends the current session summary to a session_history.json file.
    """
    try:
        state_dir = get_state_dir()
        state_dir.mkdir(parents=True, exist_ok=True)
    except (IOError, OSError) as e:
        print(f"session-stop: failed to access state dir: {e}", file=sys.stderr)
        return

    history_file = state_dir / "session_history.json"

    # Load existing history
    history = {"sessions": []}
    if history_file.exists():
        try:
            with open(history_file, "r", encoding="utf-8") as f:
                loaded = json.load(f)
            if isinstance(loaded, dict) and "sessions" in loaded:
                history = loaded
        except (json.JSONDecodeError, IOError, OSError) as e:
            print(f"session-stop: corrupt history file, starting fresh: {e}", file=sys.stderr)

    # Append current session
    summary = generate_session_summary()
    history["sessions"].append(summary)

    try:
        with open(history_file, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2)
    except (IOError, OSError) as e:
        print(f"session-stop: failed to write session history: {e}", file=sys.stderr)


def print_status() -> None:
    """Print session stop hook status report (--status flag)."""
    print("=" * 60)
    print("SESSION STOP HOOK STATUS")
    print("=" * 60)
    print()

    # Current session summary
    summary = generate_session_summary()
    print("Current Session")
    print("-" * 40)
    print(f"  Timestamp:       {summary['session_end']}")
    cs = summary["compaction_stats"]
    print(f"  Compactions:     {cs['total_compactions']}")
    print(f"  Tokens saved:    {cs['total_tokens_saved']:,}")
    print(f"  Tokens processed:{cs['total_original_tokens']:,}")
    cache = summary["cache_stats"]
    print(f"  Cache hits:      {cache['hits']}")
    print(f"  Cache misses:    {cache['misses']}")
    print()

    # Session history
    try:
        state_dir = get_state_dir()
        history_file = state_dir / "session_history.json"
        if history_file.exists():
            with open(history_file, "r", encoding="utf-8") as f:
                history = json.load(f)
            sessions = history.get("sessions", [])
            print(f"  Sessions recorded: {len(sessions)}")
        else:
            print("  Sessions recorded: 0")
    except (json.JSONDecodeError, IOError, OSError) as e:
        print(f"  Sessions recorded: unknown ({e})")
        print(f"session-stop: failed to read session history: {e}", file=sys.stderr)
    print()
    print("=" * 60)


def main():
    """
    Stop hook entry point.

    When invoked as a Stop hook, generates session summary, captures handoff
    metadata, and persists session stats.
    """
    if len(sys.argv) > 1 and sys.argv[1] == "--status":
        print_status()
        return

    # Generate and persist session stats
    persist_session_stats()

    # Capture handoff metadata if artifacts dir exists
    capture_handoff_metadata()


if __name__ == "__main__":
    main()
