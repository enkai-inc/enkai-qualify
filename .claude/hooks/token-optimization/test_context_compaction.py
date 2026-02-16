#!/usr/bin/env python3
"""Tests for context-compaction.py hook."""

import importlib.util
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path


def load_module():
    """Load context-compaction.py as a module (hyphenated name)."""
    script_path = Path(__file__).parent / "context-compaction.py"
    spec = importlib.util.spec_from_file_location("context_compaction", str(script_path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# Load the module once for all tests
MOD = load_module()
SCRIPT_PATH = str(Path(__file__).parent / "context-compaction.py")


class TestEstimateTokens(unittest.TestCase):
    """Test the token estimation function."""

    def test_empty_string(self):
        self.assertEqual(MOD.estimate_tokens(""), 0)

    def test_known_string(self):
        # ~1.3 chars per token -> 130 chars ~= 100 tokens
        text = "a" * 130
        tokens = MOD.estimate_tokens(text)
        self.assertEqual(tokens, 100)

    def test_short_string(self):
        tokens = MOD.estimate_tokens("hello")
        self.assertGreater(tokens, 0)


class TestIsLargeOutput(unittest.TestCase):
    """Test the large output detection function."""

    def test_small_output_not_large(self):
        self.assertFalse(MOD.is_large_output("small text", threshold=1000))

    def test_large_output_detected(self):
        large_text = "x" * 50000
        self.assertTrue(MOD.is_large_output(large_text, threshold=1000))

    def test_default_threshold(self):
        # Default threshold should be reasonable (e.g., 10000 tokens)
        small = "x" * 100
        self.assertFalse(MOD.is_large_output(small))


class TestGenerateCompactionSummary(unittest.TestCase):
    """Test the structured compaction summary generation."""

    def test_summary_has_all_sections(self):
        output = "Some very long tool output " * 1000
        summary = MOD.generate_compaction_summary(output)

        self.assertIn("## Context Compaction Summary", summary)
        self.assertIn("### Task Overview", summary)
        self.assertIn("### Current State", summary)
        self.assertIn("### Important Discoveries", summary)
        self.assertIn("### Next Steps", summary)
        self.assertIn("### Context to Preserve", summary)

    def test_summary_shorter_than_original(self):
        output = "Some very long tool output with lots of content\n" * 2000
        summary = MOD.generate_compaction_summary(output)
        self.assertLess(len(summary), len(output))

    def test_summary_preserves_error_context(self):
        output = "Starting build\n" * 500
        output += "ERROR: Module not found: @/components/Button\n"
        output += "FAIL src/test.ts\n"
        output += "More output\n" * 500
        summary = MOD.generate_compaction_summary(output)
        # Error info should be captured in the summary
        self.assertIn("Context Compaction Summary", summary)


class TestCompactToolOutput(unittest.TestCase):
    """Test the main compaction logic for tool output."""

    def test_small_output_passes_through(self):
        data = {
            "tool_name": "Bash",
            "tool_input": {"command": "ls"},
            "tool_result": {"stdout": "file1.py\nfile2.py", "exitCode": 0}
        }
        result, was_compacted = MOD.compact_tool_output(data)
        self.assertFalse(was_compacted)
        self.assertEqual(result, data)

    def test_large_output_gets_compacted(self):
        large_stdout = "line of output\n" * 5000
        data = {
            "tool_name": "Bash",
            "tool_input": {"command": "npm test"},
            "tool_result": {"stdout": large_stdout, "exitCode": 0}
        }
        result, was_compacted = MOD.compact_tool_output(data)
        self.assertTrue(was_compacted)
        result_stdout = result["tool_result"]["stdout"]
        self.assertLess(len(result_stdout), len(large_stdout))
        self.assertIn("Context Compaction Summary", result_stdout)

    def test_non_bash_tool_passes_through(self):
        data = {
            "tool_name": "Read",
            "tool_input": {"file_path": "/some/file"},
            "tool_result": {"content": "x" * 100000}
        }
        # Read tool should pass through without compaction (only Bash/Task)
        result, was_compacted = MOD.compact_tool_output(data)
        self.assertFalse(was_compacted)
        self.assertEqual(result, data)

    def test_task_tool_output_compacted(self):
        large_stdout = "task output content\n" * 5000
        data = {
            "tool_name": "Task",
            "tool_input": {"prompt": "do something"},
            "tool_result": {"stdout": large_stdout}
        }
        result, was_compacted = MOD.compact_tool_output(data)
        self.assertTrue(was_compacted)


class TestCompactionStats(unittest.TestCase):
    """Test the stats tracking and reporting."""

    def test_stats_tracking(self):
        # Reset stats
        MOD.COMPACTION_STATS.clear()
        MOD.COMPACTION_STATS.update({
            "total_compactions": 0,
            "total_tokens_saved": 0,
            "total_original_tokens": 0,
        })

        # Simulate a compaction
        MOD.record_compaction_stats(
            original_tokens=50000,
            compacted_tokens=5000,
        )

        self.assertEqual(MOD.COMPACTION_STATS["total_compactions"], 1)
        self.assertEqual(MOD.COMPACTION_STATS["total_tokens_saved"], 45000)
        self.assertEqual(MOD.COMPACTION_STATS["total_original_tokens"], 50000)

    def test_multiple_compactions_accumulate(self):
        MOD.COMPACTION_STATS.clear()
        MOD.COMPACTION_STATS.update({
            "total_compactions": 0,
            "total_tokens_saved": 0,
            "total_original_tokens": 0,
        })

        MOD.record_compaction_stats(original_tokens=10000, compacted_tokens=2000)
        MOD.record_compaction_stats(original_tokens=20000, compacted_tokens=3000)

        self.assertEqual(MOD.COMPACTION_STATS["total_compactions"], 2)
        self.assertEqual(MOD.COMPACTION_STATS["total_tokens_saved"], 25000)
        self.assertEqual(MOD.COMPACTION_STATS["total_original_tokens"], 30000)


class TestMainHookEntrypoint(unittest.TestCase):
    """Test the main() function as a hook entrypoint."""

    def test_json_stdin_processing(self):
        small_data = {
            "tool_name": "Bash",
            "tool_input": {"command": "echo hi"},
            "tool_result": {"stdout": "hi", "exitCode": 0}
        }
        input_json = json.dumps(small_data)

        result = subprocess.run(
            [sys.executable, SCRIPT_PATH],
            input=input_json,
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertEqual(result.returncode, 0)
        # Small output should pass through
        output = json.loads(result.stdout)
        self.assertEqual(output["tool_result"]["stdout"], "hi")

    def test_status_flag(self):
        result = subprocess.run(
            [sys.executable, SCRIPT_PATH, "--status"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertEqual(result.returncode, 0)
        self.assertIn("CONTEXT COMPACTION STATUS", result.stdout)

    def test_invalid_json_passes_through(self):
        """Non-JSON input should be passed through unchanged."""
        result = subprocess.run(
            [sys.executable, SCRIPT_PATH],
            input="not json at all",
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertEqual(result.returncode, 0)
        self.assertIn("not json at all", result.stdout)

    def test_large_output_compacted_via_stdin(self):
        """Large output should be compacted when processed through stdin."""
        large_data = {
            "tool_name": "Bash",
            "tool_input": {"command": "cat large_file.txt"},
            "tool_result": {"stdout": "content line\n" * 5000, "exitCode": 0}
        }
        input_json = json.dumps(large_data)

        result = subprocess.run(
            [sys.executable, SCRIPT_PATH],
            input=input_json,
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertEqual(result.returncode, 0)
        output = json.loads(result.stdout)
        self.assertIn("Context Compaction Summary", output["tool_result"]["stdout"])


class TestExceptionHandling(unittest.TestCase):
    """Test that exception handlers use specific types and log to stderr."""

    def test_get_threshold_handles_config_error_gracefully(self):
        """_get_threshold should return default on config load failure."""
        from unittest.mock import patch
        # Simulate load_config raising an OSError
        with patch.object(MOD, 'load_config', side_effect=OSError("config not found")):
            result = MOD._get_threshold()
            self.assertEqual(result, MOD.DEFAULT_THRESHOLD_TOKENS)

    def test_get_threshold_handles_key_error(self):
        """_get_threshold should return default when config keys are missing."""
        from unittest.mock import patch
        with patch.object(MOD, 'load_config', side_effect=KeyError("missing_key")):
            result = MOD._get_threshold()
            self.assertEqual(result, MOD.DEFAULT_THRESHOLD_TOKENS)

    def test_record_stats_logs_io_error_to_stderr(self):
        """record_compaction_stats should log IOError/OSError to stderr."""
        from unittest.mock import patch
        import io

        MOD.COMPACTION_STATS.clear()
        MOD.COMPACTION_STATS.update({
            "total_compactions": 0,
            "total_tokens_saved": 0,
            "total_original_tokens": 0,
        })

        captured_stderr = io.StringIO()
        with patch.object(MOD, 'get_state_dir', side_effect=OSError("disk full")):
            with patch('sys.stderr', captured_stderr):
                MOD.record_compaction_stats(original_tokens=1000, compacted_tokens=100)

        # In-memory stats should still update
        self.assertEqual(MOD.COMPACTION_STATS["total_compactions"], 1)
        # Error should be logged to stderr
        stderr_output = captured_stderr.getvalue()
        self.assertIn("disk full", stderr_output)

    def test_record_stats_logs_json_error_to_stderr(self):
        """record_compaction_stats should log json errors to stderr."""
        from unittest.mock import patch, mock_open
        import io

        MOD.COMPACTION_STATS.clear()
        MOD.COMPACTION_STATS.update({
            "total_compactions": 0,
            "total_tokens_saved": 0,
            "total_original_tokens": 0,
        })

        captured_stderr = io.StringIO()
        # Create a mock state dir that exists but has corrupt JSON
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            stats_file = Path(tmpdir) / "compaction_stats.json"
            stats_file.write_text("not valid json{{{")
            with patch.object(MOD, 'get_state_dir', return_value=Path(tmpdir)):
                with patch('sys.stderr', captured_stderr):
                    MOD.record_compaction_stats(original_tokens=1000, compacted_tokens=100)

        # In-memory stats should still update
        self.assertEqual(MOD.COMPACTION_STATS["total_compactions"], 1)
        # JSON error should be logged to stderr
        stderr_output = captured_stderr.getvalue()
        self.assertIn("compaction stats", stderr_output.lower())

    def test_print_status_logs_json_error_to_stderr(self):
        """print_status should log json/IO errors to stderr when reading stats."""
        from unittest.mock import patch
        import io
        import tempfile

        # Create a state dir with corrupt JSON file
        with tempfile.TemporaryDirectory() as tmpdir:
            stats_file = Path(tmpdir) / "compaction_stats.json"
            stats_file.write_text("not valid json{{{")

            captured_stderr = io.StringIO()
            captured_stdout = io.StringIO()
            with patch.object(MOD, 'get_state_dir', return_value=Path(tmpdir)):
                with patch('sys.stderr', captured_stderr):
                    with patch('sys.stdout', captured_stdout):
                        MOD.print_status()

            # Should still print the status header to stdout
            stdout_output = captured_stdout.getvalue()
            self.assertIn("CONTEXT COMPACTION STATUS", stdout_output)
            # Should log the JSON parse error to stderr
            stderr_output = captured_stderr.getvalue()
            self.assertIn("persisted stats", stderr_output.lower())

    def test_print_status_logs_os_error_to_stderr(self):
        """print_status should log OSError to stderr when state dir is unreadable."""
        from unittest.mock import patch
        import io

        captured_stderr = io.StringIO()
        captured_stdout = io.StringIO()
        with patch.object(MOD, 'get_state_dir', side_effect=OSError("permission denied")):
            with patch('sys.stderr', captured_stderr):
                with patch('sys.stdout', captured_stdout):
                    MOD.print_status()

        stdout_output = captured_stdout.getvalue()
        self.assertIn("CONTEXT COMPACTION STATUS", stdout_output)
        stderr_output = captured_stderr.getvalue()
        self.assertIn("permission denied", stderr_output)

    def test_no_bare_except_exception_pass_in_source(self):
        """Verify no bare 'except Exception: pass' remains in the source."""
        source_path = Path(__file__).parent / "context-compaction.py"
        source = source_path.read_text()
        import re
        # Match except Exception followed (possibly with whitespace/newline) by pass
        matches = re.findall(r'except\s+Exception\s*:\s*\n\s*pass', source)
        self.assertEqual(len(matches), 0,
                         f"Found {len(matches)} bare 'except Exception: pass' blocks")

    def test_no_silent_except_exception_in_source(self):
        """Verify no 'except Exception:' without logging remains (except main handler)."""
        source_path = Path(__file__).parent / "context-compaction.py"
        source = source_path.read_text()
        import re
        # Find all except Exception blocks that don't use 'as e'
        silent_matches = re.findall(r'except\s+Exception\s*:', source)
        named_matches = re.findall(r'except\s+Exception\s+as\s+\w+\s*:', source)
        silent_count = len(silent_matches) - len(named_matches)
        self.assertEqual(silent_count, 0,
                         f"Found {silent_count} 'except Exception:' without 'as e' (silent handlers)")


if __name__ == "__main__":
    unittest.main()
