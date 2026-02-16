#!/usr/bin/env python3
"""Tests for analyze-session-tokens.py session token analyzer."""

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


def load_module():
    """Load analyze-session-tokens.py as a module (hyphenated name)."""
    script_path = Path(__file__).parent / "analyze-session-tokens.py"
    spec = importlib.util.spec_from_file_location("analyze_session_tokens", str(script_path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# Load the module once for all tests
MOD = load_module()
SCRIPT_PATH = str(Path(__file__).parent / "analyze-session-tokens.py")


def make_assistant_entry(
    agent_id=None,
    slug="",
    input_tokens=100,
    output_tokens=50,
    cache_creation=200,
    cache_read=300,
):
    """Helper to create a well-formed assistant JSONL entry."""
    entry = {
        "type": "assistant",
        "message": {
            "role": "assistant",
            "usage": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "cache_creation_input_tokens": cache_creation,
                "cache_read_input_tokens": cache_read,
            },
        },
    }
    if agent_id is not None:
        entry["agentId"] = agent_id
    if slug:
        entry["slug"] = slug
    return entry


def make_user_entry(agent_id=None):
    """Helper to create a user-type entry (should be ignored by analyzer)."""
    entry = {
        "type": "user",
        "message": {"role": "user", "content": "hello"},
    }
    if agent_id is not None:
        entry["agentId"] = agent_id
    return entry


def make_progress_entry():
    """Helper to create a progress-type entry (should be ignored)."""
    return {"type": "progress", "data": {"type": "hook_progress"}}


def write_jsonl(tmpdir, filename, entries):
    """Write entries as JSONL to a file, return the Path."""
    filepath = Path(tmpdir) / filename
    filepath.parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "w") as f:
        for entry in entries:
            f.write(json.dumps(entry) + "\n")
    return filepath


class TestAgentTokens(unittest.TestCase):
    """Test the AgentTokens dataclass."""

    def test_total_input(self):
        at = MOD.AgentTokens(
            agent_id="test",
            input_tokens=100,
            cache_creation_input_tokens=200,
            cache_read_input_tokens=300,
        )
        self.assertEqual(at.total_input, 600)

    def test_total_input_zero(self):
        at = MOD.AgentTokens(agent_id="test")
        self.assertEqual(at.total_input, 0)

    def test_cache_hit_rate(self):
        at = MOD.AgentTokens(
            agent_id="test",
            input_tokens=100,
            cache_creation_input_tokens=100,
            cache_read_input_tokens=800,
        )
        self.assertAlmostEqual(at.cache_hit_rate, 80.0, places=1)

    def test_cache_hit_rate_zero_total(self):
        at = MOD.AgentTokens(agent_id="test")
        self.assertEqual(at.cache_hit_rate, 0.0)

    def test_cost_calculation(self):
        at = MOD.AgentTokens(
            agent_id="test",
            input_tokens=1_000_000,
            output_tokens=1_000_000,
            cache_creation_input_tokens=0,
            cache_read_input_tokens=0,
        )
        cost = at.cost(input_price=15.0, output_price=75.0)
        self.assertAlmostEqual(cost, 90.0, places=2)

    def test_cost_with_cache(self):
        at = MOD.AgentTokens(
            agent_id="test",
            input_tokens=0,
            output_tokens=0,
            cache_creation_input_tokens=1_000_000,
            cache_read_input_tokens=1_000_000,
        )
        cost = at.cost(cache_write_price=18.75, cache_read_price=1.50)
        self.assertAlmostEqual(cost, 20.25, places=2)


class TestExtractTokenUsage(unittest.TestCase):
    """Test token extraction from parsed entries."""

    def test_single_main_agent(self):
        entries = [
            make_assistant_entry(input_tokens=100, output_tokens=50),
        ]
        agents = MOD.extract_token_usage(entries)
        self.assertIn("main", agents)
        self.assertEqual(agents["main"].input_tokens, 100)
        self.assertEqual(agents["main"].output_tokens, 50)

    def test_named_agent(self):
        entries = [
            make_assistant_entry(agent_id="abc123", slug="happy-fox", input_tokens=500),
        ]
        agents = MOD.extract_token_usage(entries)
        self.assertIn("abc123", agents)
        self.assertEqual(agents["abc123"].input_tokens, 500)
        self.assertEqual(agents["abc123"].slug, "happy-fox")

    def test_multiple_agents(self):
        entries = [
            make_assistant_entry(input_tokens=100, output_tokens=10),
            make_assistant_entry(agent_id="sub1", input_tokens=200, output_tokens=20),
            make_assistant_entry(agent_id="sub2", input_tokens=300, output_tokens=30),
        ]
        agents = MOD.extract_token_usage(entries)
        self.assertEqual(len(agents), 3)
        self.assertEqual(agents["main"].input_tokens, 100)
        self.assertEqual(agents["sub1"].input_tokens, 200)
        self.assertEqual(agents["sub2"].input_tokens, 300)

    def test_accumulates_tokens(self):
        entries = [
            make_assistant_entry(agent_id="a1", input_tokens=100, output_tokens=10),
            make_assistant_entry(agent_id="a1", input_tokens=200, output_tokens=20),
        ]
        agents = MOD.extract_token_usage(entries)
        self.assertEqual(agents["a1"].input_tokens, 300)
        self.assertEqual(agents["a1"].output_tokens, 30)
        self.assertEqual(agents["a1"].message_count, 2)

    def test_ignores_user_entries(self):
        entries = [
            make_user_entry(),
            make_assistant_entry(input_tokens=100),
        ]
        agents = MOD.extract_token_usage(entries)
        self.assertEqual(len(agents), 1)
        self.assertEqual(agents["main"].input_tokens, 100)

    def test_ignores_progress_entries(self):
        entries = [
            make_progress_entry(),
            make_assistant_entry(input_tokens=100),
        ]
        agents = MOD.extract_token_usage(entries)
        self.assertEqual(len(agents), 1)

    def test_ignores_assistant_without_usage(self):
        entries = [
            {"type": "assistant", "message": {"role": "assistant", "content": []}},
        ]
        agents = MOD.extract_token_usage(entries)
        self.assertEqual(len(agents), 0)

    def test_cache_tokens_tracked(self):
        entries = [
            make_assistant_entry(cache_creation=500, cache_read=1000),
        ]
        agents = MOD.extract_token_usage(entries)
        self.assertEqual(agents["main"].cache_creation_input_tokens, 500)
        self.assertEqual(agents["main"].cache_read_input_tokens, 1000)

    def test_slug_preserved_from_first_entry(self):
        entries = [
            make_assistant_entry(agent_id="x", slug="first-slug"),
            make_assistant_entry(agent_id="x", slug="second-slug"),
        ]
        agents = MOD.extract_token_usage(entries)
        self.assertEqual(agents["x"].slug, "first-slug")

    def test_empty_agent_id_becomes_main(self):
        """Entries with empty string agentId should be attributed to main."""
        entries = [{"type": "assistant", "agentId": "", "message": {
            "role": "assistant",
            "usage": {"input_tokens": 42, "output_tokens": 0,
                      "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0},
        }}]
        agents = MOD.extract_token_usage(entries)
        self.assertIn("main", agents)
        self.assertEqual(agents["main"].input_tokens, 42)


class TestParseJsonlFile(unittest.TestCase):
    """Test JSONL file parsing."""

    def test_valid_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = write_jsonl(tmpdir, "test.jsonl", [
                make_assistant_entry(input_tokens=100),
                make_user_entry(),
            ])
            entries = MOD.parse_jsonl_file(filepath)
            self.assertEqual(len(entries), 2)

    def test_empty_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = write_jsonl(tmpdir, "empty.jsonl", [])
            entries = MOD.parse_jsonl_file(filepath)
            self.assertEqual(len(entries), 0)

    def test_skips_malformed_lines(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = Path(tmpdir) / "bad.jsonl"
            with open(filepath, "w") as f:
                f.write('{"valid": true}\n')
                f.write("not json at all\n")
                f.write('{"also_valid": true}\n')
            entries = MOD.parse_jsonl_file(filepath)
            self.assertEqual(len(entries), 2)

    def test_skips_blank_lines(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = Path(tmpdir) / "blanks.jsonl"
            with open(filepath, "w") as f:
                f.write('{"a": 1}\n')
                f.write("\n")
                f.write('{"b": 2}\n')
            entries = MOD.parse_jsonl_file(filepath)
            self.assertEqual(len(entries), 2)


class TestAnalyzeSessionFile(unittest.TestCase):
    """Test single-file analysis."""

    def test_basic_analysis(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = write_jsonl(tmpdir, "session.jsonl", [
                make_assistant_entry(input_tokens=1000, output_tokens=500),
                make_assistant_entry(agent_id="sub", input_tokens=2000, output_tokens=1000),
            ])
            agents = MOD.analyze_session_file(filepath)
            self.assertIn("main", agents)
            self.assertIn("sub", agents)
            self.assertEqual(agents["main"].input_tokens, 1000)
            self.assertEqual(agents["sub"].output_tokens, 1000)


class TestAnalyzeSessionDir(unittest.TestCase):
    """Test session directory analysis (main + subagents)."""

    def test_combined_analysis(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            session_id = "abc-123"
            # Main session file
            write_jsonl(tmpdir, f"{session_id}.jsonl", [
                make_assistant_entry(input_tokens=1000, output_tokens=100),
            ])
            # Subagent files
            write_jsonl(tmpdir, f"{session_id}/subagents/agent-sub1.jsonl", [
                make_assistant_entry(agent_id="sub1", input_tokens=500, output_tokens=50),
            ])
            write_jsonl(tmpdir, f"{session_id}/subagents/agent-sub2.jsonl", [
                make_assistant_entry(agent_id="sub2", input_tokens=300, output_tokens=30),
            ])

            session_dir = Path(tmpdir) / session_id
            agents = MOD.analyze_session_dir(session_dir)

            self.assertIn("main", agents)
            self.assertIn("sub1", agents)
            self.assertIn("sub2", agents)
            self.assertEqual(agents["main"].input_tokens, 1000)
            self.assertEqual(agents["sub1"].input_tokens, 500)
            self.assertEqual(agents["sub2"].input_tokens, 300)

    def test_no_main_file(self):
        """Should handle missing main session file gracefully."""
        with tempfile.TemporaryDirectory() as tmpdir:
            session_id = "no-main"
            write_jsonl(tmpdir, f"{session_id}/subagents/agent-x.jsonl", [
                make_assistant_entry(agent_id="x", input_tokens=100),
            ])
            session_dir = Path(tmpdir) / session_id
            agents = MOD.analyze_session_dir(session_dir)
            self.assertIn("x", agents)

    def test_no_subagents_dir(self):
        """Should handle missing subagents directory gracefully."""
        with tempfile.TemporaryDirectory() as tmpdir:
            session_id = "no-subs"
            write_jsonl(tmpdir, f"{session_id}.jsonl", [
                make_assistant_entry(input_tokens=100),
            ])
            # Create the session dir without subagents
            (Path(tmpdir) / session_id).mkdir()
            session_dir = Path(tmpdir) / session_id
            agents = MOD.analyze_session_dir(session_dir)
            self.assertIn("main", agents)


class TestFormatTable(unittest.TestCase):
    """Test table formatting."""

    def test_empty_agents(self):
        result = MOD.format_table({})
        self.assertEqual(result, "No token usage data found.")

    def test_contains_header(self):
        agents = {"main": MOD.AgentTokens(agent_id="main", input_tokens=100)}
        result = MOD.format_table(agents)
        self.assertIn("SESSION TOKEN ANALYSIS", result)

    def test_contains_totals(self):
        agents = {"main": MOD.AgentTokens(agent_id="main", input_tokens=100, output_tokens=50)}
        result = MOD.format_table(agents)
        self.assertIn("TOTALS", result)
        self.assertIn("100", result)

    def test_contains_agent_breakdown(self):
        agents = {
            "main": MOD.AgentTokens(agent_id="main", input_tokens=100),
            "sub1": MOD.AgentTokens(agent_id="sub1", input_tokens=200, slug="my-slug"),
        }
        result = MOD.format_table(agents)
        self.assertIn("PER-AGENT BREAKDOWN", result)
        self.assertIn("main", result)
        self.assertIn("sub1", result)

    def test_contains_pricing_note(self):
        agents = {"main": MOD.AgentTokens(agent_id="main", input_tokens=100)}
        result = MOD.format_table(agents, input_price=15.0, output_price=75.0)
        self.assertIn("$15.0/M input", result)
        self.assertIn("$75.0/M output", result)

    def test_main_agent_listed_first(self):
        agents = {
            "sub1": MOD.AgentTokens(agent_id="sub1", input_tokens=9999),
            "main": MOD.AgentTokens(agent_id="main", input_tokens=1),
        }
        result = MOD.format_table(agents)
        main_pos = result.find("main")
        sub_pos = result.find("sub1")
        # main should appear in the breakdown before sub1
        # (both appear in header area, so find in the breakdown section)
        breakdown_start = result.find("PER-AGENT BREAKDOWN")
        main_in_breakdown = result.find("main", breakdown_start + 30)
        sub_in_breakdown = result.find("sub1", breakdown_start + 30)
        self.assertLess(main_in_breakdown, sub_in_breakdown)


class TestFormatHelpers(unittest.TestCase):
    """Test formatting helper functions."""

    def test_format_number(self):
        self.assertEqual(MOD.format_number(0), "0")
        self.assertEqual(MOD.format_number(1000), "1,000")
        self.assertEqual(MOD.format_number(1234567), "1,234,567")

    def test_format_cost_small(self):
        self.assertEqual(MOD.format_cost(0.001), "$0.0010")

    def test_format_cost_normal(self):
        self.assertEqual(MOD.format_cost(1.50), "$1.50")

    def test_format_cost_large(self):
        self.assertEqual(MOD.format_cost(99.99), "$99.99")


class TestCLIIntegration(unittest.TestCase):
    """Test the CLI interface via subprocess."""

    def test_help_flag(self):
        result = subprocess.run(
            [sys.executable, SCRIPT_PATH, "--help"],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0)
        self.assertIn("Analyze Claude Code session", result.stdout)

    def test_no_args_shows_help(self):
        result = subprocess.run(
            [sys.executable, SCRIPT_PATH],
            capture_output=True, text=True,
        )
        self.assertNotEqual(result.returncode, 0)

    def test_file_not_found(self):
        result = subprocess.run(
            [sys.executable, SCRIPT_PATH, "/nonexistent/file.jsonl"],
            capture_output=True, text=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("not found", result.stderr)

    def test_analyze_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = write_jsonl(tmpdir, "test.jsonl", [
                make_assistant_entry(input_tokens=1000, output_tokens=500),
            ])
            result = subprocess.run(
                [sys.executable, SCRIPT_PATH, str(filepath)],
                capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 0)
            self.assertIn("SESSION TOKEN ANALYSIS", result.stdout)
            self.assertIn("1,000", result.stdout)

    def test_json_output(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = write_jsonl(tmpdir, "test.jsonl", [
                make_assistant_entry(input_tokens=1000, output_tokens=500, cache_creation=200, cache_read=300),
            ])
            result = subprocess.run(
                [sys.executable, SCRIPT_PATH, str(filepath), "--json"],
                capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 0)
            data = json.loads(result.stdout)
            self.assertIn("agents", data)
            self.assertIn("main", data["agents"])
            self.assertEqual(data["agents"]["main"]["input_tokens"], 1000)
            self.assertEqual(data["agents"]["main"]["output_tokens"], 500)
            self.assertIn("pricing", data)

    def test_custom_pricing(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            filepath = write_jsonl(tmpdir, "test.jsonl", [
                make_assistant_entry(input_tokens=1000),
            ])
            result = subprocess.run(
                [sys.executable, SCRIPT_PATH, str(filepath),
                 "--input-price", "3", "--output-price", "15"],
                capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 0)
            self.assertIn("$3.0/M input", result.stdout)
            self.assertIn("$15.0/M output", result.stdout)


if __name__ == "__main__":
    unittest.main()
