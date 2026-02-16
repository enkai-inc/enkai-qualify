#!/usr/bin/env python3
"""Tests for compress-test-output.py hook."""

import importlib.util
import json
import subprocess
import sys
import unittest
from pathlib import Path


def load_module():
    """Load compress-test-output.py as a module (hyphenated name)."""
    script_path = Path(__file__).parent / "compress-test-output.py"
    spec = importlib.util.spec_from_file_location("compress_test_output", str(script_path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# Load the module once for all tests
MOD = load_module()
SCRIPT_PATH = str(Path(__file__).parent / "compress-test-output.py")


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

    def test_proportional(self):
        """Longer strings should produce proportionally more tokens."""
        short_tokens = MOD.estimate_tokens("x" * 100)
        long_tokens = MOD.estimate_tokens("x" * 1000)
        self.assertAlmostEqual(long_tokens / short_tokens, 10.0, places=0)


class TestIsTestOutput(unittest.TestCase):
    """Test the test output detection function."""

    def test_jest_pass_output(self):
        output = "PASS src/components/Button.test.tsx"
        self.assertTrue(MOD.is_test_output(output))

    def test_jest_fail_output(self):
        output = "FAIL src/components/Button.test.tsx"
        self.assertTrue(MOD.is_test_output(output))

    def test_test_count_line(self):
        output = "Tests: 5 passed, 5 total"
        self.assertTrue(MOD.is_test_output(output))

    def test_suite_count_line(self):
        output = "Suites: 3 passed, 3 total"
        self.assertTrue(MOD.is_test_output(output))

    def test_checkmark_pass(self):
        output = "  \u2713 should render correctly"
        self.assertTrue(MOD.is_test_output(output))

    def test_cross_fail(self):
        output = "  \u2717 should handle errors"
        self.assertTrue(MOD.is_test_output(output))

    def test_npm_test_command(self):
        output = "npm run test"
        self.assertTrue(MOD.is_test_output(output))

    def test_jest_runner(self):
        output = "jest --coverage"
        self.assertTrue(MOD.is_test_output(output))

    def test_vitest_runner(self):
        output = "vitest run"
        self.assertTrue(MOD.is_test_output(output))

    def test_mocha_runner(self):
        output = "mocha tests/"
        self.assertTrue(MOD.is_test_output(output))

    def test_playwright_runner(self):
        output = "playwright test"
        self.assertTrue(MOD.is_test_output(output))

    def test_non_test_output(self):
        output = "file1.py\nfile2.py\nfile3.py"
        self.assertFalse(MOD.is_test_output(output))

    def test_empty_string(self):
        self.assertFalse(MOD.is_test_output(""))

    def test_generic_command_output(self):
        output = "total 24\ndrwxr-xr-x 5 user staff 160 Jan 1 00:00 src"
        self.assertFalse(MOD.is_test_output(output))


class TestCompressTestOutput(unittest.TestCase):
    """Test the compression logic for test output."""

    def _make_passing_output(self, num_passing=50):
        """Generate realistic Jest-style test output with passing tests."""
        lines = [
            "PASS src/components/Button.test.tsx",
            "  Button Component",
        ]
        for i in range(num_passing):
            lines.append(f"    \u2713 should handle case {i} (5 ms)")
        lines.extend([
            "",
            "Test Suites: 1 passed, 1 total",
            "Tests:       {0} passed, {0} total".format(num_passing),
            "Time:        2.5 s",
            "Ran all test suites.",
        ])
        return "\n".join(lines)

    def _make_failing_output(self, num_passing=20):
        """Generate realistic Jest-style test output with a failure."""
        lines = [
            "FAIL src/components/Button.test.tsx",
            "  Button Component",
        ]
        for i in range(num_passing):
            lines.append(f"    \u2713 should handle case {i} (5 ms)")
        lines.extend([
            "    \u2717 should render correctly (10 ms)",
            "",
            "  \u25cf Button Component > should render correctly",
            "",
            "    Expected: 'hello'",
            "    Received: 'world'",
            "",
            "      at Object.<anonymous> (src/components/Button.test.tsx:15:5)",
            "",
            "Test Suites: 1 failed, 1 total",
            "Tests:       1 failed, {0} passed, {1} total".format(num_passing, num_passing + 1),
            "Time:        3.1 s",
            "Ran all test suites.",
        ])
        return "\n".join(lines)

    def test_passing_tests_get_omitted(self):
        """Passing test lines (checkmarks) should be omitted."""
        output = self._make_passing_output(50)
        compressed, stats = MOD.compress_test_output(output)
        self.assertGreater(stats['omitted_lines'], 0)
        self.assertIn("omitted for brevity", compressed)

    def test_failure_lines_preserved(self):
        """Failure details must be preserved in compressed output."""
        output = self._make_failing_output(20)
        compressed, stats = MOD.compress_test_output(output)
        self.assertIn("Expected", compressed)
        self.assertIn("Received", compressed)
        self.assertIn("FAIL", compressed)

    def test_error_stack_traces_preserved(self):
        """Stack trace lines should be kept."""
        output = self._make_failing_output(20)
        compressed, stats = MOD.compress_test_output(output)
        self.assertIn("at Object.<anonymous>", compressed)

    def test_summary_lines_preserved(self):
        """Test summary (Tests:, Suites:, Time:, Ran) should be preserved."""
        output = self._make_passing_output(50)
        compressed, stats = MOD.compress_test_output(output)
        self.assertIn("Test Suites:", compressed)
        self.assertIn("Tests:", compressed)
        self.assertIn("Time:", compressed)

    def test_stats_structure(self):
        """Stats dict should contain expected keys."""
        output = self._make_passing_output(50)
        _, stats = MOD.compress_test_output(output)
        expected_keys = {
            'original_lines', 'compressed_lines', 'omitted_lines',
            'original_tokens', 'compressed_tokens', 'savings_percent'
        }
        self.assertEqual(set(stats.keys()), expected_keys)

    def test_savings_percent_calculated(self):
        """Savings percent should be reasonable for large passing output."""
        output = self._make_passing_output(100)
        _, stats = MOD.compress_test_output(output)
        self.assertGreater(stats['savings_percent'], 0)

    def test_small_output_minimal_compression(self):
        """Very short output should have minimal or no compression."""
        output = "PASS src/test.tsx\nTests: 1 passed, 1 total\nTime: 0.5s"
        _, stats = MOD.compress_test_output(output)
        # With only 3 lines (all < threshold for first/last), nothing is omitted
        self.assertEqual(stats['omitted_lines'], 0)

    def test_first_and_last_lines_always_kept(self):
        """First 3 and last 5 lines should always be preserved."""
        lines = ["line-first-0", "line-first-1", "line-first-2"]
        # Add many passing lines in the middle
        for i in range(50):
            lines.append(f"    \u2713 passing test {i}")
        lines.extend([
            "line-last-4", "line-last-3", "line-last-2",
            "line-last-1", "line-last-0"
        ])
        output = "\n".join(lines)
        compressed, _ = MOD.compress_test_output(output)
        self.assertIn("line-first-0", compressed)
        self.assertIn("line-first-1", compressed)
        self.assertIn("line-first-2", compressed)
        self.assertIn("line-last-0", compressed)
        self.assertIn("line-last-4", compressed)

    def test_error_block_continuation(self):
        """Lines immediately after an error should be kept (up to 10 lines)."""
        lines = ["header1", "header2", "header3"]
        lines.append("ERROR: something went wrong")
        for i in range(15):
            lines.append(f"  error context line {i}")
        lines.extend(["", "", "", "", "footer"])
        output = "\n".join(lines)
        compressed, _ = MOD.compress_test_output(output)
        # First 10 lines after ERROR should be kept
        self.assertIn("error context line 0", compressed)
        self.assertIn("error context line 9", compressed)

    def test_windows_pass_markers_omitted(self):
        """Windows-style pass markers (square root symbol) should be omitted."""
        lines = ["header1", "header2", "header3"]
        for i in range(20):
            lines.append(f"    \u221a test passes {i}")
        lines.extend(["", "Tests: 20 passed", "Time: 1s", "", "done"])
        output = "\n".join(lines)
        compressed, stats = MOD.compress_test_output(output)
        self.assertGreater(stats['omitted_lines'], 0)

    def test_dot_progress_omitted(self):
        """Dot-progress lines should be omitted."""
        lines = ["header1", "header2", "header3"]
        for _ in range(20):
            lines.append(" . ")
        lines.extend(["", "Tests: 20 passed", "Time: 1s", "", "done"])
        output = "\n".join(lines)
        compressed, stats = MOD.compress_test_output(output)
        self.assertGreater(stats['omitted_lines'], 0)


class TestMainPassthrough(unittest.TestCase):
    """Test that main() passes through non-test/non-Bash output unchanged."""

    def test_non_bash_tool_passes_through(self):
        """Non-Bash tool results should pass through unchanged."""
        data = {
            "tool": "Read",
            "result": {"content": "file contents here"}
        }
        input_json = json.dumps(data)
        result = subprocess.run(
            [sys.executable, SCRIPT_PATH],
            input=input_json,
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertEqual(result.returncode, 0)
        output = json.loads(result.stdout)
        self.assertEqual(output["tool"], "Read")
        self.assertEqual(output["result"]["content"], "file contents here")

    def test_bash_non_test_output_passes_through(self):
        """Bash output that is not test output should pass through unchanged."""
        data = {
            "tool": "Bash",
            "result": {
                "stdout": "file1.py\nfile2.py\nfile3.py",
                "stderr": "",
                "exitCode": 0
            }
        }
        input_json = json.dumps(data)
        result = subprocess.run(
            [sys.executable, SCRIPT_PATH],
            input=input_json,
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertEqual(result.returncode, 0)
        output = json.loads(result.stdout)
        self.assertEqual(output["result"]["stdout"], "file1.py\nfile2.py\nfile3.py")

    def test_small_test_output_below_savings_threshold(self):
        """Test output with <5% savings should not be compressed."""
        # Small test output that won't gain much from compression
        data = {
            "tool": "Bash",
            "result": {
                "stdout": "PASS src/test.tsx\nTests: 1 passed\nTime: 0.5s",
                "stderr": "",
                "exitCode": 0
            }
        }
        input_json = json.dumps(data)
        result = subprocess.run(
            [sys.executable, SCRIPT_PATH],
            input=input_json,
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertEqual(result.returncode, 0)
        output = json.loads(result.stdout)
        # Should not have compression stats because savings < 5%
        self.assertNotIn("_compression_stats", output.get("result", {}))


class TestMainCompression(unittest.TestCase):
    """Test that main() compresses large test output."""

    def _make_large_test_data(self, num_passing=100, stream="stdout"):
        """Build a Bash tool result with large test output."""
        lines = ["PASS src/components/Button.test.tsx", "  Button Component"]
        for i in range(num_passing):
            lines.append(f"    \u2713 should handle case {i} (5 ms)")
        lines.extend([
            "",
            f"Test Suites: 1 passed, 1 total",
            f"Tests:       {num_passing} passed, {num_passing} total",
            "Time:        2.5 s",
            "Ran all test suites.",
        ])
        output = "\n".join(lines)
        result = {"stdout": "", "stderr": "", "exitCode": 0}
        result[stream] = output
        return {"tool": "Bash", "result": result}

    def test_stdout_compressed(self):
        """Large test output in stdout should be compressed."""
        data = self._make_large_test_data(100, "stdout")
        input_json = json.dumps(data)
        result = subprocess.run(
            [sys.executable, SCRIPT_PATH],
            input=input_json,
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertEqual(result.returncode, 0)
        output = json.loads(result.stdout)
        self.assertIn("_compression_stats", output["result"])
        self.assertIn("stdout", output["result"]["_compression_stats"])
        stats = output["result"]["_compression_stats"]["stdout"]
        self.assertGreater(stats["savings_percent"], 5)

    def test_stderr_compressed(self):
        """Large test output in stderr should be compressed."""
        data = self._make_large_test_data(100, "stderr")
        input_json = json.dumps(data)
        result = subprocess.run(
            [sys.executable, SCRIPT_PATH],
            input=input_json,
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertEqual(result.returncode, 0)
        output = json.loads(result.stdout)
        self.assertIn("_compression_stats", output["result"])
        self.assertIn("stderr", output["result"]["_compression_stats"])

    def test_compressed_output_preserves_summary(self):
        """Compressed output should still contain test summary lines."""
        data = self._make_large_test_data(100, "stdout")
        input_json = json.dumps(data)
        result = subprocess.run(
            [sys.executable, SCRIPT_PATH],
            input=input_json,
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertEqual(result.returncode, 0)
        output = json.loads(result.stdout)
        compressed_stdout = output["result"]["stdout"]
        self.assertIn("Test Suites:", compressed_stdout)
        self.assertIn("Time:", compressed_stdout)

    def test_omission_notice_inserted(self):
        """Compressed output should contain an omission notice."""
        data = self._make_large_test_data(100, "stdout")
        input_json = json.dumps(data)
        result = subprocess.run(
            [sys.executable, SCRIPT_PATH],
            input=input_json,
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertEqual(result.returncode, 0)
        output = json.loads(result.stdout)
        compressed_stdout = output["result"]["stdout"]
        self.assertIn("omitted for brevity", compressed_stdout)


class TestMainErrorHandling(unittest.TestCase):
    """Test error handling in main()."""

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

    def test_empty_input_passes_through(self):
        """Empty stdin should not crash."""
        result = subprocess.run(
            [sys.executable, SCRIPT_PATH],
            input="",
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertEqual(result.returncode, 0)

    def test_malformed_tool_result(self):
        """JSON with unexpected structure should pass through."""
        data = {"tool": "Bash", "result": "not_a_dict"}
        input_json = json.dumps(data)
        result = subprocess.run(
            [sys.executable, SCRIPT_PATH],
            input=input_json,
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertEqual(result.returncode, 0)
        # Should not crash; either passes through or handles gracefully

    def test_missing_result_key(self):
        """JSON missing the 'result' key should pass through."""
        data = {"tool": "Bash"}
        input_json = json.dumps(data)
        result = subprocess.run(
            [sys.executable, SCRIPT_PATH],
            input=input_json,
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertEqual(result.returncode, 0)

    def test_missing_stdout_key(self):
        """Result missing stdout should not crash."""
        data = {"tool": "Bash", "result": {"exitCode": 0}}
        input_json = json.dumps(data)
        result = subprocess.run(
            [sys.executable, SCRIPT_PATH],
            input=input_json,
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertEqual(result.returncode, 0)
        output = json.loads(result.stdout)
        self.assertEqual(output["tool"], "Bash")


if __name__ == "__main__":
    unittest.main()
