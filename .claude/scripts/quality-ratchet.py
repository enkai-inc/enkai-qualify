#!/usr/bin/env python3
"""
Quality Ratchet — Progressive quality thresholds that never decrease.

Usage:
  python3 quality-ratchet.py capture <verify-json>   # Save baseline from /verify output
  python3 quality-ratchet.py check <verify-json>      # Compare against baseline, exit 1 if regressed
  python3 quality-ratchet.py show                     # Show current baseline
  python3 quality-ratchet.py update <verify-json>     # Update baseline (after merge to main)

The baseline file (.quality-baseline.json) should be committed to the repo.
"""

import json
import sys
import os
from datetime import datetime, timezone

BASELINE_FILE = ".quality-baseline.json"


def find_baseline_path():
    """Walk up from cwd to find .quality-baseline.json or default to repo root."""
    # Try cwd first
    if os.path.exists(BASELINE_FILE):
        return BASELINE_FILE
    # Try git root
    import subprocess
    try:
        root = subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"],
            stderr=subprocess.DEVNULL
        ).decode().strip()
        return os.path.join(root, BASELINE_FILE)
    except (subprocess.CalledProcessError, FileNotFoundError, OSError) as e:
        print(f"quality-ratchet: git root detection failed: {e}", file=sys.stderr)
        return BASELINE_FILE


def extract_metrics(verify_json):
    """Extract ratchet-relevant metrics from /verify JSON output."""
    return {
        "lint_errors": verify_json.get("lint", {}).get("errors", 0),
        "lint_warnings": verify_json.get("lint", {}).get("warnings", 0),
        "type_errors": verify_json.get("typeCheck", {}).get("errors", 0),
        "test_failed": verify_json.get("tests", {}).get("failed", 0),
        "test_passed": verify_json.get("tests", {}).get("passed", 0),
        "test_skipped": verify_json.get("tests", {}).get("skipped", 0),
    }


def load_baseline(path):
    """Load existing baseline or return None."""
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        return None


def save_baseline(path, metrics, verify_json):
    """Save metrics as the new baseline."""
    baseline = {
        "version": 1,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "metrics": metrics,
        "verify_status": verify_json.get("status", "unknown"),
    }
    with open(path, "w") as f:
        json.dump(baseline, f, indent=2)
        f.write("\n")
    return baseline


def compare(baseline_metrics, current_metrics):
    """Compare current metrics against baseline. Return list of regressions."""
    regressions = []

    # These should never increase (lower is better)
    for key in ["lint_errors", "lint_warnings", "type_errors", "test_failed"]:
        old = baseline_metrics.get(key, 0)
        new = current_metrics.get(key, 0)
        if new > old:
            regressions.append({
                "metric": key,
                "baseline": old,
                "current": new,
                "delta": new - old,
                "direction": "increased (bad)",
            })

    # test_passed should never decrease (higher is better)
    old_passed = baseline_metrics.get("test_passed", 0)
    new_passed = current_metrics.get("test_passed", 0)
    if new_passed < old_passed:
        regressions.append({
            "metric": "test_passed",
            "baseline": old_passed,
            "current": new_passed,
            "delta": new_passed - old_passed,
            "direction": "decreased (bad)",
        })

    return regressions


def format_metrics(metrics):
    """Format metrics for display."""
    lines = []
    for key, value in metrics.items():
        label = key.replace("_", " ").title()
        lines.append(f"  {label}: {value}")
    return "\n".join(lines)


def parse_verify_input(arg):
    """Parse verify JSON from file path or stdin."""
    try:
        if arg == "-":
            return json.load(sys.stdin)
        with open(arg) as f:
            return json.load(f)
    except FileNotFoundError as e:
        print(f"quality-ratchet: input file not found: {e}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"quality-ratchet: invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)
    except IOError as e:
        print(f"quality-ratchet: I/O error reading input: {e}", file=sys.stderr)
        sys.exit(1)


def cmd_capture(verify_json):
    path = find_baseline_path()
    metrics = extract_metrics(verify_json)
    baseline = save_baseline(path, metrics, verify_json)
    print(f"Baseline captured to {path}")
    print(format_metrics(metrics))
    return 0


def cmd_check(verify_json):
    path = find_baseline_path()
    baseline = load_baseline(path)

    if baseline is None:
        print(f"No baseline found at {path}. Run 'capture' first.")
        print("Treating as pass (no baseline to regress against).")
        return 0

    current = extract_metrics(verify_json)
    regressions = compare(baseline["metrics"], current)

    if not regressions:
        print("Quality ratchet: PASS — no regressions detected")
        print(f"\nBaseline ({baseline['updated_at']}):")
        print(format_metrics(baseline["metrics"]))
        print(f"\nCurrent:")
        print(format_metrics(current))

        # Check for improvements worth celebrating
        improvements = []
        for key in ["lint_errors", "lint_warnings", "type_errors", "test_failed"]:
            old = baseline["metrics"].get(key, 0)
            new = current.get(key, 0)
            if new < old:
                improvements.append(f"  {key}: {old} -> {new} (improved!)")
        old_passed = baseline["metrics"].get("test_passed", 0)
        new_passed = current.get("test_passed", 0)
        if new_passed > old_passed:
            improvements.append(f"  test_passed: {old_passed} -> {new_passed} (improved!)")

        if improvements:
            print(f"\nImprovements (consider updating baseline):")
            for imp in improvements:
                print(imp)
        return 0
    else:
        print("Quality ratchet: FAIL — regressions detected!")
        print(f"\nBaseline ({baseline['updated_at']}):")
        print(format_metrics(baseline["metrics"]))
        print(f"\nCurrent:")
        print(format_metrics(current))
        print(f"\nRegressions:")
        for r in regressions:
            label = r["metric"].replace("_", " ").title()
            print(f"  {label}: {r['baseline']} -> {r['current']} ({r['direction']})")
        return 1


def cmd_show():
    path = find_baseline_path()
    baseline = load_baseline(path)
    if baseline is None:
        print(f"No baseline found at {path}")
        return 1
    print(f"Quality baseline ({path}):")
    print(f"  Updated: {baseline['updated_at']}")
    print(f"  Status: {baseline['verify_status']}")
    print(format_metrics(baseline["metrics"]))
    return 0


def cmd_update(verify_json):
    path = find_baseline_path()
    old_baseline = load_baseline(path)
    current = extract_metrics(verify_json)

    if old_baseline:
        # Only update if current is equal or better
        regressions = compare(old_baseline["metrics"], current)
        if regressions:
            print("Cannot update baseline — current metrics are worse than baseline!")
            for r in regressions:
                label = r["metric"].replace("_", " ").title()
                print(f"  {label}: {r['baseline']} -> {r['current']} ({r['direction']})")
            return 1

    baseline = save_baseline(path, current, verify_json)
    print(f"Baseline updated at {path}")
    if old_baseline:
        print(f"\nPrevious ({old_baseline['updated_at']}):")
        print(format_metrics(old_baseline["metrics"]))
    print(f"\nNew ({baseline['updated_at']}):")
    print(format_metrics(current))
    return 0


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    command = sys.argv[1]

    if command == "show":
        return cmd_show()

    if command in ("capture", "check", "update"):
        if len(sys.argv) < 3:
            print(f"Usage: quality-ratchet.py {command} <verify-json-file | ->")
            return 1
        verify_json = parse_verify_input(sys.argv[2])
        if command == "capture":
            return cmd_capture(verify_json)
        elif command == "check":
            return cmd_check(verify_json)
        elif command == "update":
            return cmd_update(verify_json)

    print(f"Unknown command: {command}")
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main())
