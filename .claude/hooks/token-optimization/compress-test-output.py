#!/usr/bin/env python3
"""
Test Output Compression Hook

Compresses verbose test output to reduce token usage while preserving
critical information (failures, errors, summary).

Estimated savings: 10-30% on test cycles

Usage: Called as a PostToolUse hook on Bash tool results
"""

import json
import re
import sys
from typing import Optional


def estimate_tokens(text: str) -> int:
    """Rough token estimate (~1.3 chars per token average)."""
    return len(text) * 10 // 13


def compress_test_output(output: str) -> tuple[str, dict]:
    """
    Compress test output while preserving critical information.

    Returns:
        Tuple of (compressed_output, stats_dict)
    """
    lines = output.split('\n')
    original_lines = len(lines)
    original_tokens = estimate_tokens(output)

    # Patterns to always keep
    keep_patterns = [
        r'FAIL',
        r'ERROR',
        r'WARN',
        r'Tests?:',
        r'Suites?:',
        r'Time:',
        r'Ran \d+',
        r'passed',
        r'failed',
        r'skipped',
        r'pending',
        r'✗|✘|×',  # Failure markers
        r'AssertionError',
        r'TypeError',
        r'ReferenceError',
        r'Expected',
        r'Received',
        r'at .+:\d+:\d+',  # Stack trace lines
        r'^\s*>\s+\d+\s*\|',  # Code snippets in errors
        r'PASS\s+\S+\.test\.',  # Test file results
        r'FAIL\s+\S+\.test\.',
    ]

    # Patterns for passing tests (can be summarized)
    pass_patterns = [
        r'^\s*✓\s+',  # Jest/Vitest pass marker
        r'^\s*√\s+',  # Windows pass marker
        r'^\s*✔\s+',  # Another pass marker
        r'PASS\s+src/',  # Passing test files
        r'^\s*\.\s*$',  # Dot progress
    ]

    kept_lines = []
    omitted_count = 0
    in_error_block = False
    error_block_lines = 0

    for i, line in enumerate(lines):
        # Always keep first and last few lines for context
        if i < 3 or i >= len(lines) - 5:
            kept_lines.append(line)
            continue

        # Check if we should keep this line
        should_keep = False

        # Check keep patterns
        for pattern in keep_patterns:
            if re.search(pattern, line, re.IGNORECASE):
                should_keep = True
                in_error_block = True
                error_block_lines = 0
                break

        # Keep lines immediately after errors (stack trace context)
        if in_error_block and error_block_lines < 10:
            should_keep = True
            error_block_lines += 1
            if error_block_lines >= 10 or (line.strip() == '' and error_block_lines > 3):
                in_error_block = False

        # Check if it's a pass line we can omit
        is_pass_line = False
        for pattern in pass_patterns:
            if re.search(pattern, line):
                is_pass_line = True
                break

        if should_keep:
            kept_lines.append(line)
        elif is_pass_line:
            omitted_count += 1
        else:
            # Keep non-pass, non-keep lines (might be important)
            kept_lines.append(line)

    # Insert omission notice if we removed lines
    if omitted_count > 0:
        # Find a good place to insert the notice (after header, before summary)
        insert_idx = min(5, len(kept_lines) - 1)
        kept_lines.insert(insert_idx, f"\n... [{omitted_count} passing test lines omitted for brevity] ...\n")

    compressed = '\n'.join(kept_lines)
    compressed_tokens = estimate_tokens(compressed)

    stats = {
        'original_lines': original_lines,
        'compressed_lines': len(kept_lines),
        'omitted_lines': omitted_count,
        'original_tokens': original_tokens,
        'compressed_tokens': compressed_tokens,
        'savings_percent': round((1 - compressed_tokens / max(original_tokens, 1)) * 100, 1)
    }

    return compressed, stats


def is_test_output(output: str) -> bool:
    """Check if the output looks like test runner output."""
    test_indicators = [
        r'PASS\s+',
        r'FAIL\s+',
        r'Tests?:\s+\d+',
        r'Suites?:\s+\d+',
        r'✓\s+',
        r'✗\s+',
        r'npm\s+(run\s+)?test',
        r'jest',
        r'vitest',
        r'mocha',
        r'playwright',
    ]

    for pattern in test_indicators:
        if re.search(pattern, output, re.IGNORECASE):
            return True
    return False


def main():
    """
    Process tool result from stdin and output compressed version.

    Expected input format (JSON):
    {
        "tool": "Bash",
        "result": {
            "stdout": "...",
            "stderr": "...",
            "exitCode": 0
        }
    }
    """
    try:
        input_data = sys.stdin.read()

        # Parse the tool result
        try:
            data = json.loads(input_data)
        except json.JSONDecodeError:
            # Not JSON, might be raw output - pass through
            print(input_data, end='')
            return

        # Check if this is a Bash tool result
        if data.get('tool') != 'Bash':
            print(json.dumps(data))
            return

        result = data.get('result', {})
        stdout = result.get('stdout', '')
        stderr = result.get('stderr', '')

        # Check if this looks like test output
        combined_output = stdout + stderr
        if not is_test_output(combined_output):
            print(json.dumps(data))
            return

        # Compress the output
        modified = False

        if stdout and is_test_output(stdout):
            compressed_stdout, stdout_stats = compress_test_output(stdout)
            if stdout_stats['savings_percent'] > 5:  # Only compress if >5% savings
                result['stdout'] = compressed_stdout
                result['_compression_stats'] = {
                    'stdout': stdout_stats
                }
                modified = True

        if stderr and is_test_output(stderr):
            compressed_stderr, stderr_stats = compress_test_output(stderr)
            if stderr_stats['savings_percent'] > 5:
                result['stderr'] = compressed_stderr
                if '_compression_stats' not in result:
                    result['_compression_stats'] = {}
                result['_compression_stats']['stderr'] = stderr_stats
                modified = True

        if modified:
            data['result'] = result

        print(json.dumps(data))

    except Exception as e:
        # On any error, pass through unchanged
        sys.stderr.write(f"compress-test-output error: {e}\n")
        print(input_data, end='')


if __name__ == '__main__':
    main()
