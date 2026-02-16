#!/usr/bin/env python3
"""
Token Optimization Status

Shows the current status and metrics for all token optimization utilities.
"""

import importlib.util
import sys
from pathlib import Path

# Import shared config loader
sys.path.insert(0, str(Path(__file__).parent))
from config_loader import get_state_dir, get_cache_dir

STATE_DIR = get_state_dir()


def _load_session_analyzer():
    """Load the session token analyzer module (hyphenated filename)."""
    script_path = Path(__file__).parent / "analyze-session-tokens.py"
    if not script_path.exists():
        return None
    spec = importlib.util.spec_from_file_location("analyze_session_tokens", str(script_path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def format_number(n: int) -> str:
    """Format number with commas."""
    return f"{n:,}"


def main():
    print("=" * 60)
    print("TOKEN OPTIMIZATION STATUS")
    print("=" * 60)
    print()

    # Atlas Cache
    print("🗃️  ATLAS CACHE")
    print("-" * 40)
    if STATE_DIR.parent.exists():
        cache_dir = get_cache_dir()
        if cache_dir.exists():
            repos = list(cache_dir.iterdir())
            total_size = 0
            for repo_dir in repos:
                if repo_dir.is_dir():
                    for f in repo_dir.glob('*.json'):
                        total_size += f.stat().st_size
            print(f"  Cached repos:     {len(repos)}")
            print(f"  Cache size:       {total_size / 1024:.1f} KB")
        else:
            print("  No cache yet")
    print()

    # Session Token Analysis
    print("📈 SESSION TOKEN ANALYSIS")
    print("-" * 40)
    analyzer = _load_session_analyzer()
    if analyzer:
        latest = analyzer.find_latest_session()
        if latest:
            try:
                agents = analyzer.analyze_session_file(latest)
                total_input = sum(a.total_input for a in agents.values())
                total_output = sum(a.output_tokens for a in agents.values())
                total_cost = sum(a.cost() for a in agents.values())
                avg_cache_hit = (
                    sum(a.cache_read_input_tokens for a in agents.values())
                    / max(total_input, 1)
                    * 100
                )
                print(f"  Latest session:   {latest.name}")
                print(f"  Agents:           {len(agents)}")
                print(f"  Total input:      {format_number(total_input)}")
                print(f"  Total output:     {format_number(total_output)}")
                print(f"  Cache hit rate:   {avg_cache_hit:.1f}%")
                print(f"  Estimated cost:   ${total_cost:.4f}")
            except Exception as e:
                print(f"  Error analyzing session: {e}")
        else:
            print("  No session files found")
    else:
        print("  Analyzer not available")
    print()

    # Summary
    print("📊 SUMMARY")
    print("-" * 40)

    print(f"  Active hooks: compress-test-output, atlas-cache, context-compaction")
    print(f"  Analysis tools: analyze-session-tokens")
    print()
    print("=" * 60)


if __name__ == '__main__':
    main()
