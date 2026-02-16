"""Tests for improved exception handling in quality-ratchet.py and setup_claude_config.py."""

import importlib.util
import json
import os
import subprocess
import sys
import tempfile
from io import StringIO
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Load quality-ratchet.py as a module (filename has hyphens)
_qr_spec = importlib.util.spec_from_file_location(
    "quality_ratchet",
    os.path.join(os.path.dirname(__file__), "quality-ratchet.py"),
)
quality_ratchet = importlib.util.module_from_spec(_qr_spec)
_qr_spec.loader.exec_module(quality_ratchet)

# Load setup_claude_config.py
_sc_spec = importlib.util.spec_from_file_location(
    "setup_claude_config",
    os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "setup_claude_config.py"),
)
setup_claude_config = importlib.util.module_from_spec(_sc_spec)
_sc_spec.loader.exec_module(setup_claude_config)


class TestFindBaselinePathExceptionHandling:
    """Test that find_baseline_path catches specific exceptions and logs to stderr."""

    def test_catches_called_process_error(self, capsys, tmp_path, monkeypatch):
        """When git fails with CalledProcessError, should catch and return default."""
        monkeypatch.chdir(tmp_path)

        def mock_check_output(*args, **kwargs):
            raise subprocess.CalledProcessError(128, "git")

        with patch("subprocess.check_output", side_effect=mock_check_output):
            result = quality_ratchet.find_baseline_path()

        assert result == ".quality-baseline.json"
        captured = capsys.readouterr()
        assert "quality-ratchet: git root detection failed:" in captured.err

    def test_catches_file_not_found_error(self, capsys, tmp_path, monkeypatch):
        """When git binary is not found, should catch and return default."""
        monkeypatch.chdir(tmp_path)

        def mock_check_output(*args, **kwargs):
            raise FileNotFoundError("git not found")

        with patch("subprocess.check_output", side_effect=mock_check_output):
            result = quality_ratchet.find_baseline_path()

        assert result == ".quality-baseline.json"
        captured = capsys.readouterr()
        assert "quality-ratchet: git root detection failed:" in captured.err

    def test_catches_os_error(self, capsys, tmp_path, monkeypatch):
        """When OS error occurs, should catch and return default."""
        monkeypatch.chdir(tmp_path)

        def mock_check_output(*args, **kwargs):
            raise OSError("some OS error")

        with patch("subprocess.check_output", side_effect=mock_check_output):
            result = quality_ratchet.find_baseline_path()

        assert result == ".quality-baseline.json"
        captured = capsys.readouterr()
        assert "quality-ratchet: git root detection failed:" in captured.err

    def test_does_not_catch_unexpected_exceptions(self, tmp_path, monkeypatch):
        """Unexpected exceptions like ValueError should propagate."""
        monkeypatch.chdir(tmp_path)

        def mock_check_output(*args, **kwargs):
            raise ValueError("unexpected error")

        with patch("subprocess.check_output", side_effect=mock_check_output):
            with pytest.raises(ValueError, match="unexpected error"):
                quality_ratchet.find_baseline_path()


class TestParseVerifyInputExceptionHandling:
    """Test that parse_verify_input handles file/JSON errors gracefully."""

    def test_handles_file_not_found(self, capsys):
        """Missing file should print to stderr and sys.exit(1)."""
        with pytest.raises(SystemExit) as exc_info:
            quality_ratchet.parse_verify_input("/nonexistent/file.json")
        assert exc_info.value.code == 1
        captured = capsys.readouterr()
        assert "quality-ratchet:" in captured.err

    def test_handles_invalid_json(self, capsys, tmp_path):
        """Invalid JSON should print to stderr and sys.exit(1)."""
        bad_file = tmp_path / "bad.json"
        bad_file.write_text("not valid json {{{")
        with pytest.raises(SystemExit) as exc_info:
            quality_ratchet.parse_verify_input(str(bad_file))
        assert exc_info.value.code == 1
        captured = capsys.readouterr()
        assert "quality-ratchet:" in captured.err

    def test_handles_io_error_on_stdin(self, capsys):
        """IOError on stdin should print to stderr and sys.exit(1)."""
        mock_stdin = MagicMock()
        mock_stdin.read.side_effect = IOError("stdin broken")
        with patch.object(json, "load", side_effect=IOError("stdin broken")):
            with patch.object(sys, "stdin", mock_stdin):
                with pytest.raises(SystemExit) as exc_info:
                    quality_ratchet.parse_verify_input("-")
                assert exc_info.value.code == 1
                captured = capsys.readouterr()
                assert "quality-ratchet:" in captured.err

    def test_valid_file_still_works(self, tmp_path):
        """Valid JSON files should still parse correctly."""
        good_file = tmp_path / "good.json"
        good_file.write_text('{"status": "pass", "lint": {"errors": 0}}')
        result = quality_ratchet.parse_verify_input(str(good_file))
        assert result == {"status": "pass", "lint": {"errors": 0}}

    def test_valid_stdin_still_works(self):
        """Valid JSON from stdin should still parse correctly."""
        mock_stdin = StringIO('{"status": "pass"}')
        with patch.object(sys, "stdin", mock_stdin):
            result = quality_ratchet.parse_verify_input("-")
        assert result == {"status": "pass"}


class TestDetectGitInfoExceptionHandling:
    """Test that detect_git_info in setup_claude_config catches specific exceptions."""

    def test_catches_called_process_error(self, capsys):
        """CalledProcessError should be caught and logged to stderr."""
        def mock_run(*args, **kwargs):
            raise subprocess.CalledProcessError(128, "git")

        with patch("subprocess.run", side_effect=mock_run):
            result = setup_claude_config.detect_git_info()

        assert result["name"] != ""  # Falls back to directory name
        captured = capsys.readouterr()
        assert "setup_claude_config: git detection failed:" in captured.err

    def test_catches_file_not_found_error(self, capsys):
        """FileNotFoundError should be caught and logged to stderr."""
        def mock_run(*args, **kwargs):
            raise FileNotFoundError("git not found")

        with patch("subprocess.run", side_effect=mock_run):
            result = setup_claude_config.detect_git_info()

        assert result["name"] != ""  # Falls back to directory name
        captured = capsys.readouterr()
        assert "setup_claude_config: git detection failed:" in captured.err

    def test_catches_os_error(self, capsys):
        """OSError should be caught and logged to stderr."""
        def mock_run(*args, **kwargs):
            raise OSError("permission denied")

        with patch("subprocess.run", side_effect=mock_run):
            result = setup_claude_config.detect_git_info()

        assert result["name"] != ""  # Falls back to directory name
        captured = capsys.readouterr()
        assert "setup_claude_config: git detection failed:" in captured.err

    def test_does_not_catch_unexpected_exceptions(self):
        """Unexpected exceptions like TypeError should propagate."""
        def mock_run(*args, **kwargs):
            raise TypeError("unexpected")

        with patch("subprocess.run", side_effect=mock_run):
            with pytest.raises(TypeError, match="unexpected"):
                setup_claude_config.detect_git_info()
