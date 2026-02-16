#!/usr/bin/env python3
"""
Session Transcript Token Analyzer

Parses Claude Code JSONL session files and produces per-agent token breakdowns
with cost estimation. Supports both single-file analysis and auto-discovery of
the latest session.

Usage:
  python3 analyze-session-tokens.py <session.jsonl>
  python3 analyze-session-tokens.py --latest
  python3 analyze-session-tokens.py --session-dir ~/.claude/projects/<project>/<session-id>
"""

import argparse
import json
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple


# Default Opus pricing (USD per million tokens)
DEFAULT_INPUT_PRICE = 15.0
DEFAULT_OUTPUT_PRICE = 75.0
DEFAULT_CACHE_WRITE_PRICE = 18.75  # 1.25x input
DEFAULT_CACHE_READ_PRICE = 1.50  # 0.1x input


@dataclass
class AgentTokens:
    """Token usage accumulator for a single agent."""

    agent_id: str
    slug: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    cache_creation_input_tokens: int = 0
    cache_read_input_tokens: int = 0
    message_count: int = 0

    @property
    def total_input(self) -> int:
        """Total input tokens including cache operations."""
        return self.input_tokens + self.cache_creation_input_tokens + self.cache_read_input_tokens

    @property
    def cache_hit_rate(self) -> float:
        """Percentage of input tokens served from cache."""
        total = self.total_input
        if total == 0:
            return 0.0
        return (self.cache_read_input_tokens / total) * 100

    def cost(
        self,
        input_price: float = DEFAULT_INPUT_PRICE,
        output_price: float = DEFAULT_OUTPUT_PRICE,
        cache_write_price: float = DEFAULT_CACHE_WRITE_PRICE,
        cache_read_price: float = DEFAULT_CACHE_READ_PRICE,
    ) -> float:
        """Estimate cost in USD."""
        return (
            (self.input_tokens / 1_000_000) * input_price
            + (self.output_tokens / 1_000_000) * output_price
            + (self.cache_creation_input_tokens / 1_000_000) * cache_write_price
            + (self.cache_read_input_tokens / 1_000_000) * cache_read_price
        )


def parse_jsonl_file(filepath: Path) -> List[dict]:
    """Parse a JSONL file, yielding valid JSON objects line by line."""
    entries = []
    with open(filepath, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                print(
                    f"  warning: skipped malformed JSON at line {line_num}",
                    file=sys.stderr,
                )
    return entries


def extract_token_usage(entries: List[dict]) -> Dict[str, AgentTokens]:
    """
    Extract per-agent token usage from parsed JSONL entries.

    Groups by agentId field. Entries without agentId are attributed to 'main'.
    """
    agents: Dict[str, AgentTokens] = {}

    for entry in entries:
        if entry.get("type") != "assistant":
            continue

        message = entry.get("message")
        if not isinstance(message, dict):
            continue

        usage = message.get("usage")
        if not usage:
            continue

        agent_id = entry.get("agentId", "main") or "main"
        slug = entry.get("slug", "")

        if agent_id not in agents:
            agents[agent_id] = AgentTokens(agent_id=agent_id, slug=slug)
        elif slug and not agents[agent_id].slug:
            agents[agent_id].slug = slug

        agent = agents[agent_id]
        agent.input_tokens += usage.get("input_tokens", 0)
        agent.output_tokens += usage.get("output_tokens", 0)
        agent.cache_creation_input_tokens += usage.get("cache_creation_input_tokens", 0)
        agent.cache_read_input_tokens += usage.get("cache_read_input_tokens", 0)
        agent.message_count += 1

    return agents


def analyze_session_file(filepath: Path) -> Dict[str, AgentTokens]:
    """Analyze a single JSONL session file."""
    entries = parse_jsonl_file(filepath)
    return extract_token_usage(entries)


def analyze_session_dir(session_dir: Path) -> Dict[str, AgentTokens]:
    """
    Analyze a full session directory including subagent files.

    Session directory structure:
      <session-id>.jsonl          - main session
      <session-id>/subagents/     - subagent JSONL files
    """
    all_agents: Dict[str, AgentTokens] = {}

    # Find the main session file (same name as dir but with .jsonl)
    main_file = session_dir.with_suffix(".jsonl")
    if main_file.exists():
        agents = analyze_session_file(main_file)
        all_agents.update(agents)

    # Find subagent files
    subagent_dir = session_dir / "subagents"
    if subagent_dir.exists():
        for jsonl_file in sorted(subagent_dir.glob("*.jsonl")):
            agents = analyze_session_file(jsonl_file)
            for agent_id, tokens in agents.items():
                if agent_id in all_agents:
                    existing = all_agents[agent_id]
                    existing.input_tokens += tokens.input_tokens
                    existing.output_tokens += tokens.output_tokens
                    existing.cache_creation_input_tokens += tokens.cache_creation_input_tokens
                    existing.cache_read_input_tokens += tokens.cache_read_input_tokens
                    existing.message_count += tokens.message_count
                    if tokens.slug and not existing.slug:
                        existing.slug = tokens.slug
                else:
                    all_agents[agent_id] = tokens

    return all_agents


def find_latest_session(project_dir: Optional[Path] = None) -> Optional[Path]:
    """
    Find the most recent session JSONL file.

    Searches ~/.claude/projects/ for the latest .jsonl file by modification time.
    If project_dir is given, searches only that project's sessions.
    """
    claude_projects = Path.home() / ".claude" / "projects"
    if not claude_projects.exists():
        return None

    if project_dir:
        search_dirs = [project_dir]
    else:
        search_dirs = list(claude_projects.iterdir())

    latest_file = None
    latest_mtime = 0.0

    for search_dir in search_dirs:
        if not search_dir.is_dir():
            # Could be a .jsonl file at the project level
            if search_dir.suffix == ".jsonl" and search_dir.stat().st_mtime > latest_mtime:
                latest_mtime = search_dir.stat().st_mtime
                latest_file = search_dir
            continue
        for jsonl_file in search_dir.rglob("*.jsonl"):
            mtime = jsonl_file.stat().st_mtime
            if mtime > latest_mtime:
                latest_mtime = mtime
                latest_file = jsonl_file

    return latest_file


def format_number(n: int) -> str:
    """Format number with commas."""
    return f"{n:,}"


def format_cost(cost: float) -> str:
    """Format cost in USD."""
    if cost < 0.01:
        return f"${cost:.4f}"
    return f"${cost:.2f}"


def format_table(
    agents: Dict[str, AgentTokens],
    input_price: float = DEFAULT_INPUT_PRICE,
    output_price: float = DEFAULT_OUTPUT_PRICE,
    cache_write_price: float = DEFAULT_CACHE_WRITE_PRICE,
    cache_read_price: float = DEFAULT_CACHE_READ_PRICE,
) -> str:
    """Format token usage as a readable table."""
    if not agents:
        return "No token usage data found."

    lines = []
    lines.append("=" * 90)
    lines.append("SESSION TOKEN ANALYSIS")
    lines.append("=" * 90)
    lines.append("")

    # Summary totals
    total = AgentTokens(agent_id="TOTAL")
    for agent in agents.values():
        total.input_tokens += agent.input_tokens
        total.output_tokens += agent.output_tokens
        total.cache_creation_input_tokens += agent.cache_creation_input_tokens
        total.cache_read_input_tokens += agent.cache_read_input_tokens
        total.message_count += agent.message_count

    lines.append("TOTALS")
    lines.append("-" * 50)
    lines.append(f"  Input tokens:          {format_number(total.input_tokens):>15}")
    lines.append(f"  Output tokens:         {format_number(total.output_tokens):>15}")
    lines.append(f"  Cache write tokens:    {format_number(total.cache_creation_input_tokens):>15}")
    lines.append(f"  Cache read tokens:     {format_number(total.cache_read_input_tokens):>15}")
    lines.append(f"  Total input (all):     {format_number(total.total_input):>15}")
    lines.append(f"  Cache hit rate:        {total.cache_hit_rate:>14.1f}%")
    lines.append(
        f"  Estimated cost:        {format_cost(total.cost(input_price, output_price, cache_write_price, cache_read_price)):>15}"
    )
    lines.append(f"  Assistant messages:    {format_number(total.message_count):>15}")
    lines.append(f"  Agents:                {len(agents):>15}")
    lines.append("")

    # Per-agent breakdown
    lines.append("PER-AGENT BREAKDOWN")
    lines.append("-" * 90)

    # Header
    header = f"{'Agent':<25} {'Input':>10} {'Output':>10} {'Cache W':>10} {'Cache R':>10} {'Hit%':>6} {'Cost':>10} {'Msgs':>5}"
    lines.append(header)
    lines.append("-" * 90)

    # Sort agents: main first, then by total input descending
    sorted_agents = sorted(
        agents.values(),
        key=lambda a: (0 if a.agent_id == "main" else 1, -a.total_input),
    )

    for agent in sorted_agents:
        label = agent.agent_id
        if agent.slug:
            label = f"{agent.agent_id} ({agent.slug[:12]})"
        if len(label) > 24:
            label = label[:24]

        cost = agent.cost(input_price, output_price, cache_write_price, cache_read_price)

        row = (
            f"{label:<25} "
            f"{format_number(agent.input_tokens):>10} "
            f"{format_number(agent.output_tokens):>10} "
            f"{format_number(agent.cache_creation_input_tokens):>10} "
            f"{format_number(agent.cache_read_input_tokens):>10} "
            f"{agent.cache_hit_rate:>5.1f}% "
            f"{format_cost(cost):>10} "
            f"{agent.message_count:>5}"
        )
        lines.append(row)

    lines.append("-" * 90)
    lines.append("")

    # Pricing note
    lines.append(
        f"Pricing: ${input_price}/M input, ${output_price}/M output, "
        f"${cache_write_price}/M cache-write, ${cache_read_price}/M cache-read"
    )
    lines.append("")

    return "\n".join(lines)


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Analyze Claude Code session transcripts for token usage and cost.",
    )
    parser.add_argument(
        "file",
        nargs="?",
        help="Path to a JSONL session file to analyze",
    )
    parser.add_argument(
        "--latest",
        action="store_true",
        help="Auto-discover and analyze the latest session",
    )
    parser.add_argument(
        "--session-dir",
        type=str,
        help="Path to a session directory (analyzes main + subagents)",
    )
    parser.add_argument(
        "--input-price",
        type=float,
        default=DEFAULT_INPUT_PRICE,
        help=f"Input price per M tokens (default: ${DEFAULT_INPUT_PRICE})",
    )
    parser.add_argument(
        "--output-price",
        type=float,
        default=DEFAULT_OUTPUT_PRICE,
        help=f"Output price per M tokens (default: ${DEFAULT_OUTPUT_PRICE})",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON instead of formatted table",
    )

    args = parser.parse_args()

    if not args.file and not args.latest and not args.session_dir:
        parser.print_help()
        sys.exit(1)

    # Determine what to analyze
    if args.session_dir:
        session_dir = Path(args.session_dir)
        if not session_dir.exists():
            print(f"Error: session directory not found: {session_dir}", file=sys.stderr)
            sys.exit(1)
        agents = analyze_session_dir(session_dir)
    elif args.latest:
        latest = find_latest_session()
        if not latest:
            print("Error: no session files found", file=sys.stderr)
            sys.exit(1)
        print(f"Analyzing: {latest}", file=sys.stderr)
        agents = analyze_session_file(latest)
    else:
        filepath = Path(args.file)
        if not filepath.exists():
            print(f"Error: file not found: {filepath}", file=sys.stderr)
            sys.exit(1)
        agents = analyze_session_file(filepath)

    # Output
    cache_write_price = args.input_price * 1.25
    cache_read_price = args.input_price * 0.1

    if args.json:
        result = {
            "agents": {
                aid: {
                    "agent_id": a.agent_id,
                    "slug": a.slug,
                    "input_tokens": a.input_tokens,
                    "output_tokens": a.output_tokens,
                    "cache_creation_input_tokens": a.cache_creation_input_tokens,
                    "cache_read_input_tokens": a.cache_read_input_tokens,
                    "total_input": a.total_input,
                    "cache_hit_rate": round(a.cache_hit_rate, 1),
                    "estimated_cost_usd": round(
                        a.cost(args.input_price, args.output_price, cache_write_price, cache_read_price),
                        4,
                    ),
                    "message_count": a.message_count,
                }
                for aid, a in agents.items()
            },
            "pricing": {
                "input_per_m": args.input_price,
                "output_per_m": args.output_price,
                "cache_write_per_m": cache_write_price,
                "cache_read_per_m": cache_read_price,
            },
        }
        print(json.dumps(result, indent=2))
    else:
        print(
            format_table(
                agents,
                input_price=args.input_price,
                output_price=args.output_price,
                cache_write_price=cache_write_price,
                cache_read_price=cache_read_price,
            )
        )


if __name__ == "__main__":
    main()
