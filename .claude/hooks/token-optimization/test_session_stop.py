#!/usr/bin/env python3
"""Tests for session-stop.py Stop hook."""

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


def load_module():
    """Load session-stop.py as a module (hyphenated name)."""
    script_path = Path(__file__).parent / "session-stop.py"
    spec = importlib.util.spec_from_file_location("session_stop", str(script_path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# Will be loaded after the module exists
MOD = None
SCRIPT_PATH = str(Path(__file__).parent / "session-stop.py")


def setUpModule():
    """Load the module once for all tests."""
    global MOD
    MOD = load_module()


class TestGenerateSessionSummary(unittest.TestCase):
    """Test the session summary generation."""

    def test_summary_returns_dict(self):
        summary = MOD.generate_session_summary()
        self.assertIsInstance(summary, dict)

    def test_summary_contains_required_keys(self):
        summary = MOD.generate_session_summary()
        self.assertIn("session_end", summary)
        self.assertIn("compaction_stats", summary)
        self.assertIn("cache_stats", summary)

    def test_summary_reads_persisted_compaction_stats(self):
        """Summary should include compaction stats from state dir."""
        with tempfile.TemporaryDirectory() as tmpdir:
            stats = {"total_compactions": 5, "total_tokens_saved": 25000, "total_original_tokens": 50000}
            stats_file = Path(tmpdir) / "compaction_stats.json"
            stats_file.write_text(json.dumps(stats))

            with patch.object(MOD, 'get_state_dir', return_value=Path(tmpdir)):
                summary = MOD.generate_session_summary()

            self.assertEqual(summary["compaction_stats"]["total_compactions"], 5)
            self.assertEqual(summary["compaction_stats"]["total_tokens_saved"], 25000)

    def test_summary_handles_missing_stats_gracefully(self):
        """Summary should return empty stats when no persisted data exists."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(MOD, 'get_state_dir', return_value=Path(tmpdir)):
                summary = MOD.generate_session_summary()

            self.assertEqual(summary["compaction_stats"]["total_compactions"], 0)

    def test_summary_includes_timestamp(self):
        summary = MOD.generate_session_summary()
        # ISO 8601 format check
        self.assertRegex(summary["session_end"], r"\d{4}-\d{2}-\d{2}T")


class TestHandoffMetadataCapture(unittest.TestCase):
    """Test the handoff metadata capture to artifacts directory."""

    def test_captures_handoff_when_artifact_index_exists(self):
        """Should write handoff metadata when .claude/artifacts/ dir exists."""
        with tempfile.TemporaryDirectory() as tmpdir:
            artifacts_dir = Path(tmpdir) / ".claude" / "artifacts" / "handoffs"
            artifacts_dir.mkdir(parents=True)

            with patch.object(MOD, 'get_project_dir', return_value=Path(tmpdir)):
                with patch.object(MOD, 'get_state_dir', return_value=Path(tmpdir) / "state"):
                    result = MOD.capture_handoff_metadata()

            self.assertTrue(result)
            handoff_files = list(artifacts_dir.glob("*.json"))
            self.assertEqual(len(handoff_files), 1)

            with open(handoff_files[0]) as f:
                handoff_data = json.load(f)
            self.assertIn("session_end", handoff_data)
            self.assertIn("summary", handoff_data)

    def test_skips_when_no_artifacts_dir(self):
        """Should skip handoff capture when .claude/artifacts/handoffs/ does not exist."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch.object(MOD, 'get_project_dir', return_value=Path(tmpdir)):
                result = MOD.capture_handoff_metadata()

            self.assertFalse(result)

    def test_handoff_file_contains_session_summary(self):
        """Handoff metadata should include the session summary."""
        with tempfile.TemporaryDirectory() as tmpdir:
            artifacts_dir = Path(tmpdir) / ".claude" / "artifacts" / "handoffs"
            artifacts_dir.mkdir(parents=True)

            # Create fake compaction stats
            state_dir = Path(tmpdir) / "state"
            state_dir.mkdir(parents=True)
            stats = {"total_compactions": 3, "total_tokens_saved": 15000, "total_original_tokens": 30000}
            (state_dir / "compaction_stats.json").write_text(json.dumps(stats))

            with patch.object(MOD, 'get_project_dir', return_value=Path(tmpdir)):
                with patch.object(MOD, 'get_state_dir', return_value=state_dir):
                    MOD.capture_handoff_metadata()

            handoff_files = list(artifacts_dir.glob("*.json"))
            with open(handoff_files[0]) as f:
                handoff_data = json.load(f)
            self.assertEqual(handoff_data["summary"]["compaction_stats"]["total_compactions"], 3)


class TestStatsPersistence(unittest.TestCase):
    """Test writing session stats to state dir for cross-session tracking."""

    def test_writes_session_stats_file(self):
        """Should write session stats to state dir."""
        with tempfile.TemporaryDirectory() as tmpdir:
            state_dir = Path(tmpdir)
            with patch.object(MOD, 'get_state_dir', return_value=state_dir):
                MOD.persist_session_stats()

            stats_file = state_dir / "session_history.json"
            self.assertTrue(stats_file.exists())

            with open(stats_file) as f:
                history = json.load(f)
            self.assertIn("sessions", history)
            self.assertGreaterEqual(len(history["sessions"]), 1)

    def test_appends_to_existing_history(self):
        """Should append to existing session history, not overwrite."""
        with tempfile.TemporaryDirectory() as tmpdir:
            state_dir = Path(tmpdir)
            existing = {"sessions": [{"session_end": "2025-01-01T00:00:00", "compaction_stats": {}}]}
            (state_dir / "session_history.json").write_text(json.dumps(existing))

            with patch.object(MOD, 'get_state_dir', return_value=state_dir):
                MOD.persist_session_stats()

            with open(state_dir / "session_history.json") as f:
                history = json.load(f)
            self.assertEqual(len(history["sessions"]), 2)

    def test_handles_corrupt_history_file(self):
        """Should start fresh if existing history file is corrupt."""
        with tempfile.TemporaryDirectory() as tmpdir:
            state_dir = Path(tmpdir)
            (state_dir / "session_history.json").write_text("not valid json{{{")

            with patch.object(MOD, 'get_state_dir', return_value=state_dir):
                MOD.persist_session_stats()

            with open(state_dir / "session_history.json") as f:
                history = json.load(f)
            self.assertIn("sessions", history)
            self.assertEqual(len(history["sessions"]), 1)

    def test_handles_state_dir_write_error(self):
        """Should handle OSError gracefully when state dir is unwritable."""
        import io
        captured_stderr = io.StringIO()
        with patch.object(MOD, 'get_state_dir', side_effect=OSError("disk full")):
            with patch('sys.stderr', captured_stderr):
                # Should not raise
                MOD.persist_session_stats()

        self.assertIn("disk full", captured_stderr.getvalue())


class TestStatusFlag(unittest.TestCase):
    """Test the --status CLI flag."""

    def test_status_flag_outputs_report(self):
        result = subprocess.run(
            [sys.executable, SCRIPT_PATH, "--status"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertEqual(result.returncode, 0)
        self.assertIn("SESSION STOP HOOK STATUS", result.stdout)

    def test_status_flag_shows_session_count(self):
        result = subprocess.run(
            [sys.executable, SCRIPT_PATH, "--status"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertEqual(result.returncode, 0)
        # Should show some session count info
        self.assertIn("Sessions recorded", result.stdout)


class TestMainEntrypoint(unittest.TestCase):
    """Test the main() function as a Stop hook entrypoint."""

    def test_main_runs_without_error(self):
        """Stop hook main should run and exit cleanly."""
        result = subprocess.run(
            [sys.executable, SCRIPT_PATH],
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertEqual(result.returncode, 0)

    def test_no_bare_except_in_source(self):
        """Verify no bare 'except Exception: pass' remains in the source."""
        import re
        source_path = Path(__file__).parent / "session-stop.py"
        source = source_path.read_text()
        matches = re.findall(r'except\s+Exception\s*:\s*\n\s*pass', source)
        self.assertEqual(len(matches), 0,
                         f"Found {len(matches)} bare 'except Exception: pass' blocks")


if __name__ == "__main__":
    unittest.main()
