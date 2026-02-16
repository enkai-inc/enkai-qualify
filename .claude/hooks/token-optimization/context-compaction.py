#!/usr/bin/env python3
"""
Context Compaction Hook

Generates structured summaries for large tool outputs to reduce token usage
when conversations approach context limits. Designed for long-running skill
workflows (scrum workers, build pipelines, etc.).

Estimated savings: 40-70% on large tool outputs

Usage:
  Called as a PostToolUse hook on Bash/Task tool results.
  python context-compaction.py              # Process stdin (hook mode)
  python context-compaction.py --status     # Report compaction stats
"""

import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

# Import shared config loader and intent classifier
sys.path.insert(0, str(Path(__file__).parent))
from config_loader import get_state_dir, load_config

# Lazy import to avoid circular dependency at module level
_intent_classifier = None


def _get_intent_classifier():
    """Lazy-load intent-classifier.py module."""
    global _intent_classifier
    if _intent_classifier is None:
        import importlib.util
        classifier_path = Path(__file__).parent / "intent-classifier.py"
        spec = importlib.util.spec_from_file_location("intent_classifier", str(classifier_path))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _intent_classifier = mod
    return _intent_classifier


# Default threshold in estimated tokens for triggering compaction
DEFAULT_THRESHOLD_TOKENS = 10000

# Intent-adjusted threshold multipliers: lighter tasks compact more aggressively
# (lower multiplier = lower threshold = more aggressive compaction)
INTENT_THRESHOLD_MULTIPLIERS = {
    "ultra_light": 0.3,   # Compact aggressively -- minimal context needed
    "light": 0.5,         # Moderate compaction
    "medium": 1.0,        # Default threshold
    "heavy": 1.5,         # Less aggressive -- preserve more context
    "ultra_heavy": 2.0,   # Preserve as much context as possible
}

# Tools that trigger compaction
COMPACTABLE_TOOLS = {"Bash", "Task"}

# Patterns indicating important content to preserve
IMPORTANT_PATTERNS = [
    r'ERROR',
    r'FAIL',
    r'WARN(?:ING)?',
    r'WORKER_COMPLETE',
    r'Exception',
    r'Traceback',
    r'assert(?:ion)?.*(?:error|fail)',
    r'(?:npm|yarn|pnpm)\s+ERR!',
    r'exit\s+code\s+[1-9]',
    r'PASS\s+\S+\.test\.',
    r'FAIL\s+\S+\.test\.',
    r'Tests?:\s+\d+',
    r'Suites?:\s+\d+',
    r'PR:\s+https?://',
    r'STATUS:\s+(?:success|failure)',
]

# In-memory stats for the current session
COMPACTION_STATS: Dict[str, int] = {
    "total_compactions": 0,
    "total_tokens_saved": 0,
    "total_original_tokens": 0,
}


def estimate_tokens(text: str) -> int:
    """Rough token estimate (~1.3 chars per token average)."""
    return len(text) * 10 // 13


def is_large_output(text: str, threshold: Optional[int] = None) -> bool:
    """Check if text exceeds the token threshold for compaction."""
    if threshold is None:
        threshold = _get_threshold()
    return estimate_tokens(text) > threshold


def _get_threshold() -> int:
    """Get the compaction threshold from project config or default."""
    try:
        config = load_config()
        token_config = config.get("token_optimization", {})
        return token_config.get("warn_threshold_tokens", DEFAULT_THRESHOLD_TOKENS)
    except (json.JSONDecodeError, IOError, OSError, KeyError) as e:
        print(f"context-compaction: config load failed: {e}", file=sys.stderr)
        return DEFAULT_THRESHOLD_TOKENS


def get_intent_adjusted_threshold(command: str = "") -> int:
    """
    Get a compaction threshold adjusted by intent classification.

    Lighter tasks get a lower threshold (more aggressive compaction) because
    they need less context. Heavier tasks get a higher threshold to preserve
    more output detail.

    Args:
        command: The command or prompt string to classify.

    Returns:
        Adjusted threshold in estimated tokens.
    """
    base_threshold = _get_threshold()
    try:
        classifier = _get_intent_classifier()
        intent = classifier.classify_intent(command)
        level = intent.get("level", "medium")
        multiplier = INTENT_THRESHOLD_MULTIPLIERS.get(level, 1.0)
        return max(1000, int(base_threshold * multiplier))
    except (ImportError, AttributeError, OSError) as e:
        print(f"context-compaction: intent classification failed, using default: {e}", file=sys.stderr)
        return base_threshold


def _extract_important_lines(text: str, max_lines: int = 50) -> list:
    """Extract lines matching important patterns from the output."""
    lines = text.split('\n')
    important = []
    seen = set()

    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue
        for pattern in IMPORTANT_PATTERNS:
            if re.search(pattern, line, re.IGNORECASE):
                if stripped not in seen:
                    important.append(stripped)
                    seen.add(stripped)
                    # Also grab 1-2 lines of context after
                    for j in range(1, 3):
                        if i + j < len(lines) and lines[i + j].strip():
                            ctx = lines[i + j].strip()
                            if ctx not in seen:
                                important.append(f"  {ctx}")
                                seen.add(ctx)
                break
        if len(important) >= max_lines:
            break

    return important


def _extract_head_tail(text: str, head_lines: int = 10, tail_lines: int = 10) -> Tuple[list, list]:
    """Extract the first and last N lines of output for context."""
    lines = text.split('\n')
    head = [l.strip() for l in lines[:head_lines] if l.strip()]
    tail = [l.strip() for l in lines[-tail_lines:] if l.strip()]
    return head, tail


def generate_compaction_summary(output: str, command: str = "", tool_name: str = "") -> str:
    """
    Generate a structured compaction summary from large tool output.

    The summary preserves critical information (errors, test results, status signals)
    while dramatically reducing token count.
    """
    original_tokens = estimate_tokens(output)
    lines = output.split('\n')
    total_lines = len(lines)

    # Extract important lines
    important_lines = _extract_important_lines(output)

    # Extract head/tail for context
    head, tail = _extract_head_tail(output)

    # Determine task context from command
    task_desc = command if command else "Tool output processing"
    if len(task_desc) > 200:
        task_desc = task_desc[:200] + "..."

    # Detect state indicators
    has_errors = any(re.search(r'ERROR|FAIL|Exception|Traceback', l, re.IGNORECASE) for l in important_lines)
    has_success = any(re.search(r'PASS|success|complete', l, re.IGNORECASE) for l in important_lines)

    state_indicator = "In progress"
    if has_errors:
        state_indicator = "Errors detected in output"
    elif has_success:
        state_indicator = "Successful completion signals detected"

    # Build summary sections
    sections = []
    sections.append("## Context Compaction Summary")
    sections.append(f"_Compacted {total_lines} lines ({original_tokens:,} tokens) of {tool_name or 'tool'} output_\n")

    sections.append("### Task Overview")
    sections.append(f"{task_desc}\n")

    sections.append("### Current State")
    sections.append(f"{state_indicator}\n")

    sections.append("### Important Discoveries")
    if important_lines:
        for line in important_lines[:30]:
            sections.append(f"- {line}")
    else:
        sections.append("- No errors, warnings, or notable patterns detected")
    sections.append("")

    sections.append("### Next Steps")
    if has_errors:
        sections.append("- Review and address the errors listed above")
    elif has_success:
        sections.append("- Continue with next workflow step")
    else:
        sections.append("- Continue processing; output was routine")
    sections.append("")

    sections.append("### Context to Preserve")
    sections.append("**Output start:**")
    for line in head[:5]:
        sections.append(f"  {line}")
    sections.append("**Output end:**")
    for line in tail[:5]:
        sections.append(f"  {line}")

    return '\n'.join(sections)


def compact_tool_output(data: Dict[str, Any]) -> Tuple[Dict[str, Any], bool]:
    """
    Compact tool output if it exceeds the threshold.

    Args:
        data: The tool use data dict with tool_name, tool_input, tool_result.

    Returns:
        Tuple of (possibly modified data, was_compacted boolean).
    """
    tool_name = data.get("tool_name", "")

    # Only compact Bash and Task tool outputs
    if tool_name not in COMPACTABLE_TOOLS:
        return data, False

    tool_result = data.get("tool_result", {})
    tool_input = data.get("tool_input", {})
    command = tool_input.get("command", tool_input.get("prompt", ""))

    # Get the output text (could be stdout or other fields)
    stdout = tool_result.get("stdout", "")
    stderr = tool_result.get("stderr", "")
    combined = stdout + stderr

    # Use intent-adjusted threshold for smarter compaction decisions
    adjusted_threshold = get_intent_adjusted_threshold(command)
    if not is_large_output(combined, threshold=adjusted_threshold):
        return data, False

    # Generate compaction summary
    summary = generate_compaction_summary(
        combined,
        command=command,
        tool_name=tool_name,
    )

    # Record stats
    original_tokens = estimate_tokens(combined)
    compacted_tokens = estimate_tokens(summary)
    record_compaction_stats(original_tokens, compacted_tokens)

    # Replace the output with the summary
    result_copy = dict(tool_result)
    result_copy["stdout"] = summary
    if stderr:
        result_copy["stderr"] = ""  # Errors are captured in the summary
    result_copy["_compaction"] = {
        "original_tokens": original_tokens,
        "compacted_tokens": compacted_tokens,
        "savings_percent": round((1 - compacted_tokens / max(original_tokens, 1)) * 100, 1),
    }

    data_copy = dict(data)
    data_copy["tool_result"] = result_copy
    return data_copy, True


def record_compaction_stats(original_tokens: int, compacted_tokens: int) -> None:
    """Record compaction statistics for reporting."""
    COMPACTION_STATS["total_compactions"] += 1
    COMPACTION_STATS["total_tokens_saved"] += (original_tokens - compacted_tokens)
    COMPACTION_STATS["total_original_tokens"] += original_tokens

    # Persist stats to state dir
    try:
        state_dir = get_state_dir()
        state_dir.mkdir(parents=True, exist_ok=True)
        stats_file = state_dir / "compaction_stats.json"

        # Load existing persisted stats
        persisted = {}
        if stats_file.exists():
            with open(stats_file, 'r') as f:
                persisted = json.load(f)

        # Update persisted stats
        persisted["total_compactions"] = persisted.get("total_compactions", 0) + 1
        persisted["total_tokens_saved"] = persisted.get("total_tokens_saved", 0) + (original_tokens - compacted_tokens)
        persisted["total_original_tokens"] = persisted.get("total_original_tokens", 0) + original_tokens

        with open(stats_file, 'w') as f:
            json.dump(persisted, f, indent=2)
    except (json.JSONDecodeError, IOError, OSError) as e:
        print(f"context-compaction: compaction stats persistence failed: {e}", file=sys.stderr)


def print_status() -> None:
    """Print compaction status report (--status flag)."""
    print("=" * 60)
    print("CONTEXT COMPACTION STATUS")
    print("=" * 60)
    print()

    # In-memory stats
    print("Session Stats (in-memory)")
    print("-" * 40)
    print(f"  Compactions:     {COMPACTION_STATS['total_compactions']}")
    print(f"  Tokens saved:    {COMPACTION_STATS['total_tokens_saved']:,}")
    print(f"  Tokens processed:{COMPACTION_STATS['total_original_tokens']:,}")
    if COMPACTION_STATS["total_original_tokens"] > 0:
        pct = round(
            (1 - (COMPACTION_STATS["total_original_tokens"] - COMPACTION_STATS["total_tokens_saved"])
             / COMPACTION_STATS["total_original_tokens"]) * 100, 1
        )
        print(f"  Savings:         {pct}%")
    print()

    # Persisted stats
    try:
        state_dir = get_state_dir()
        stats_file = state_dir / "compaction_stats.json"
        if stats_file.exists():
            with open(stats_file, 'r') as f:
                persisted = json.load(f)
            print("Persisted Stats (across sessions)")
            print("-" * 40)
            print(f"  Compactions:     {persisted.get('total_compactions', 0)}")
            print(f"  Tokens saved:    {persisted.get('total_tokens_saved', 0):,}")
            print(f"  Tokens processed:{persisted.get('total_original_tokens', 0):,}")
            total = persisted.get("total_original_tokens", 0)
            if total > 0:
                saved = persisted.get("total_tokens_saved", 0)
                pct = round(saved / total * 100, 1)
                print(f"  Savings:         {pct}%")
        else:
            print("Persisted Stats: No data yet")
    except (json.JSONDecodeError, IOError, OSError) as e:
        print(f"Persisted Stats: Unable to read ({e})")
        print(f"context-compaction: failed to read persisted stats: {e}", file=sys.stderr)
    print()

    print(f"  Threshold:       {_get_threshold():,} tokens")
    print(f"  Compactable tools: {', '.join(sorted(COMPACTABLE_TOOLS))}")
    print()
    print("=" * 60)


def main():
    """
    Process tool result from stdin and output compacted version if needed.

    Expected input format (JSON):
    {
        "tool_name": "Bash",
        "tool_input": {"command": "..."},
        "tool_result": {"stdout": "...", "stderr": "...", "exitCode": 0}
    }
    """
    # Handle --status flag
    if len(sys.argv) > 1 and sys.argv[1] == "--status":
        print_status()
        return

    try:
        input_data = sys.stdin.read()

        # Parse the tool result
        try:
            data = json.loads(input_data)
        except json.JSONDecodeError:
            # Not JSON, pass through unchanged
            print(input_data, end='')
            return

        # Try to compact the output
        result, was_compacted = compact_tool_output(data)
        print(json.dumps(result))

    except (IOError, OSError, KeyError, TypeError, json.JSONDecodeError) as e:
        # On any error, pass through unchanged
        print(f"context-compaction error: {e}", file=sys.stderr)
        try:
            print(input_data, end='')
        except NameError:
            print("context-compaction: no input data to pass through", file=sys.stderr)


if __name__ == '__main__':
    main()
