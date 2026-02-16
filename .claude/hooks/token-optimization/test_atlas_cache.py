#!/usr/bin/env python3
"""Tests for atlas-cache.py error handling and subprocess timeouts."""

import ast
import importlib.util
import inspect
import json
import os
import re
import subprocess
import sys
import textwrap
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock


SCRIPT_PATH = Path(__file__).parent / "atlas-cache.py"


def load_module():
    """Load atlas-cache.py as a module (hyphenated name)."""
    # We need config_loader on the path
    sys.path.insert(0, str(Path(__file__).parent))
    spec = importlib.util.spec_from_file_location("atlas_cache", str(SCRIPT_PATH))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def get_source_code():
    """Read the raw source code of atlas-cache.py."""
    return SCRIPT_PATH.read_text()


def parse_ast():
    """Parse atlas-cache.py into an AST."""
    source = get_source_code()
    return ast.parse(source)


class TestSyntaxValid(unittest.TestCase):
    """Verify the file has valid Python syntax."""

    def test_syntax_parses(self):
        source = get_source_code()
        # This will raise SyntaxError if invalid
        ast.parse(source)


class TestSubprocessTimeouts(unittest.TestCase):
    """All subprocess.run() calls must have timeout=30."""

    def test_all_subprocess_run_calls_have_timeout(self):
        """Every subprocess.run() call must include a timeout keyword argument."""
        tree = parse_ast()
        missing_timeout = []

        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                # Check if this is a subprocess.run() call
                func = node.func
                is_subprocess_run = False

                if (isinstance(func, ast.Attribute)
                        and func.attr == 'run'
                        and isinstance(func.value, ast.Name)
                        and func.value.id == 'subprocess'):
                    is_subprocess_run = True

                if is_subprocess_run:
                    has_timeout = any(
                        kw.arg == 'timeout' for kw in node.keywords
                    )
                    if not has_timeout:
                        missing_timeout.append(node.lineno)

        self.assertEqual(
            missing_timeout, [],
            f"subprocess.run() calls at lines {missing_timeout} are missing timeout parameter"
        )

    def test_timeout_value_is_30(self):
        """All subprocess.run() timeout values should be 30."""
        tree = parse_ast()
        wrong_timeout = []

        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                func = node.func
                is_subprocess_run = False

                if (isinstance(func, ast.Attribute)
                        and func.attr == 'run'
                        and isinstance(func.value, ast.Name)
                        and func.value.id == 'subprocess'):
                    is_subprocess_run = True

                if is_subprocess_run:
                    for kw in node.keywords:
                        if kw.arg == 'timeout':
                            if isinstance(kw.value, ast.Constant) and kw.value.value != 30:
                                wrong_timeout.append((node.lineno, kw.value.value))

        self.assertEqual(
            wrong_timeout, [],
            f"subprocess.run() calls with wrong timeout values: {wrong_timeout}"
        )


class TestLinesIndexSafety(unittest.TestCase):
    """lines.index(line) must be wrapped in try-except ValueError."""

    def test_no_unprotected_list_index_call(self):
        """Any .index() call should be inside a try block handling ValueError."""
        source = get_source_code()
        tree = parse_ast()

        # Find all .index() calls and check they are inside a try/except
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                func = node.func
                if (isinstance(func, ast.Attribute) and func.attr == 'index'):
                    # This is a .index() call - verify it's inside a try block
                    # that catches ValueError
                    self._assert_inside_try_except(tree, node, ValueError)

    def _assert_inside_try_except(self, tree, target_node, exception_type):
        """Assert that target_node is inside a try block catching exception_type."""
        # Walk the tree to find Try nodes that contain the target
        found_in_try = self._find_enclosing_try(tree, target_node)
        self.assertTrue(
            found_in_try,
            f".index() call at line {target_node.lineno} is not inside a "
            f"try-except that catches ValueError"
        )

    def _find_enclosing_try(self, tree, target_node):
        """Check if target_node is enclosed in a try block catching ValueError."""
        for node in ast.walk(tree):
            if isinstance(node, ast.Try):
                # Check if target_node is inside this try block's body
                if self._node_in_body(node.body, target_node):
                    # Check if any handler catches ValueError
                    for handler in node.handlers:
                        if handler.type is None:
                            # bare except: catches everything
                            return True
                        if isinstance(handler.type, ast.Name) and handler.type.id == 'ValueError':
                            return True
                        if isinstance(handler.type, ast.Tuple):
                            for elt in handler.type.elts:
                                if isinstance(elt, ast.Name) and elt.id == 'ValueError':
                                    return True
        return False

    def _node_in_body(self, body_nodes, target_node):
        """Check if target_node is anywhere inside the body nodes."""
        for node in body_nodes:
            if node is target_node:
                return True
            for child in ast.walk(node):
                if child is target_node:
                    return True
        return False


class TestNoBareExceptPass(unittest.TestCase):
    """No bare 'except Exception: pass' patterns should exist."""

    def test_no_bare_except_exception_pass(self):
        """Ensure there are no 'except Exception: pass' patterns."""
        tree = parse_ast()
        bare_excepts = []

        for node in ast.walk(tree):
            if isinstance(node, ast.Try):
                for handler in node.handlers:
                    if handler.type is not None:
                        # Check if it catches the overly broad 'Exception'
                        if (isinstance(handler.type, ast.Name)
                                and handler.type.id == 'Exception'):
                            # Check if the handler body is just 'pass'
                            if (len(handler.body) == 1
                                    and isinstance(handler.body[0], ast.Pass)):
                                bare_excepts.append(handler.lineno)

        self.assertEqual(
            bare_excepts, [],
            f"Found bare 'except Exception: pass' at lines {bare_excepts}. "
            f"Use specific exception types and log to stderr instead."
        )

    def test_no_bare_except_pass(self):
        """Ensure there are no bare 'except: pass' patterns either."""
        tree = parse_ast()
        bare_excepts = []

        for node in ast.walk(tree):
            if isinstance(node, ast.Try):
                for handler in node.handlers:
                    if handler.type is None:
                        # Bare except clause
                        if (len(handler.body) == 1
                                and isinstance(handler.body[0], ast.Pass)):
                            bare_excepts.append(handler.lineno)

        self.assertEqual(
            bare_excepts, [],
            f"Found bare 'except: pass' at lines {bare_excepts}. "
            f"Use specific exception types and log to stderr instead."
        )


class TestSpecificExceptionTypes(unittest.TestCase):
    """Exception handlers should use specific types, not bare Exception."""

    def test_handlers_use_specific_types(self):
        """All exception handlers should use specific exception types, not bare Exception."""
        tree = parse_ast()
        broad_handlers = []

        for node in ast.walk(tree):
            if isinstance(node, ast.Try):
                for handler in node.handlers:
                    if handler.type is not None:
                        if (isinstance(handler.type, ast.Name)
                                and handler.type.id == 'Exception'):
                            # 'except Exception as e:' with actual handling (not just pass)
                            # is acceptable only if it's a last-resort handler
                            # But the issue asks to replace ALL with specific types
                            broad_handlers.append(handler.lineno)

        self.assertEqual(
            broad_handlers, [],
            f"Found broad 'except Exception' at lines {broad_handlers}. "
            f"Use specific types: json.JSONDecodeError, subprocess.TimeoutExpired, "
            f"FileNotFoundError, OSError, ValueError etc."
        )


class TestStderrLogging(unittest.TestCase):
    """Exception handlers that swallow errors should log to stderr."""

    def test_exception_handlers_log_or_reraise(self):
        """Exception handlers should either log to stderr or re-raise, not silently pass."""
        source = get_source_code()
        tree = parse_ast()
        silent_handlers = []

        for node in ast.walk(tree):
            if isinstance(node, ast.Try):
                for handler in node.handlers:
                    # Check if handler body is just 'pass' or just 'return None'
                    body = handler.body
                    if len(body) == 1 and isinstance(body[0], ast.Pass):
                        silent_handlers.append(handler.lineno)

        self.assertEqual(
            silent_handlers, [],
            f"Found silent exception handlers (just 'pass') at lines {silent_handlers}. "
            f"Log warnings to stderr instead."
        )


class TestModuleRuntimeBehavior(unittest.TestCase):
    """Test runtime behavior of the fixed functions."""

    def test_get_repo_hash_handles_timeout(self):
        """get_repo_hash should handle subprocess.TimeoutExpired gracefully."""
        mod = load_module()
        # Use a path where git won't work to test fallback
        result = mod.get_repo_hash(Path("/nonexistent/path"))
        # Should return a hash of the path string as fallback
        self.assertTrue(len(result) > 0)

    def test_get_commit_sha_handles_timeout(self):
        """get_commit_sha should handle subprocess.TimeoutExpired gracefully."""
        mod = load_module()
        result = mod.get_commit_sha(Path("/nonexistent/path"))
        self.assertEqual(result, 'unknown')

    def test_load_atlas_features_handles_duplicate_description_headers(self):
        """load_atlas_features should handle duplicate ## Description headers safely."""
        mod = load_module()
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            features_dir = Path(tmpdir) / mod.CONFIG['features_dir']
            features_dir.mkdir(parents=True)

            # Create a file with duplicate '## Description' lines
            test_content = (
                "# Test Feature\n"
                "## Description\n"
                "First description paragraph.\n"
                "\n"
                "## Description\n"
                "Second description paragraph.\n"
                "- Point 1\n"
                "- Point 2\n"
            )
            (features_dir / "test-feature.md").write_text(test_content)

            features = mod.load_atlas_features(Path(tmpdir))
            # Should not crash, should return a valid feature
            self.assertEqual(len(features), 1)
            self.assertEqual(features[0]['title'], 'Test Feature')


class TestInjectCommand(unittest.TestCase):
    """Tests for the inject command that outputs cached atlas context for PreToolUse hooks."""

    def setUp(self):
        """Set up a temporary repo with atlas features for inject tests."""
        import tempfile
        self._tmpdir = tempfile.mkdtemp()
        self.tmpdir = Path(self._tmpdir)
        self.mod = load_module()

        # Create a minimal features directory with content
        features_dir = self.tmpdir / self.mod.CONFIG['features_dir']
        features_dir.mkdir(parents=True)
        (features_dir / "auth.md").write_text(
            "# Authentication\n"
            "## Description\n"
            "Handles user authentication.\n"
            "- JWT tokens\n"
            "- OAuth2 support\n"
        )

    def tearDown(self):
        import shutil
        shutil.rmtree(self._tmpdir, ignore_errors=True)

    def test_is_planning_prompt_detects_plan_skill(self):
        """is_planning_prompt should return True for /plan invocations."""
        self.assertTrue(self.mod.is_planning_prompt("/plan evaluate issue #42"))

    def test_is_planning_prompt_detects_design_skill(self):
        """is_planning_prompt should return True for /design invocations."""
        self.assertTrue(self.mod.is_planning_prompt("/design deep-dive on auth module"))

    def test_is_planning_prompt_detects_dd_skill(self):
        """is_planning_prompt should return True for /dd invocations."""
        self.assertTrue(self.mod.is_planning_prompt("/dd research caching strategy"))

    def test_is_planning_prompt_detects_architecture_keyword(self):
        """is_planning_prompt should return True for architecture-related prompts."""
        self.assertTrue(self.mod.is_planning_prompt("Review the architecture of the auth module"))

    def test_is_planning_prompt_rejects_simple_bug_fix(self):
        """is_planning_prompt should return False for simple non-planning prompts."""
        self.assertFalse(self.mod.is_planning_prompt("Fix the typo in README.md"))

    def test_is_planning_prompt_rejects_empty(self):
        """is_planning_prompt should return False for empty prompts."""
        self.assertFalse(self.mod.is_planning_prompt(""))

    def test_inject_context_with_planning_prompt(self):
        """inject_context should return decision='inject' with context for planning prompts."""
        result = self.mod.inject_context(self.tmpdir, "/plan evaluate the auth feature")
        self.assertEqual(result["decision"], "inject")
        self.assertIn("context", result)
        self.assertTrue(len(result["context"]) > 0)

    def test_inject_context_with_non_planning_prompt(self):
        """inject_context should return decision='skip' for non-planning prompts."""
        result = self.mod.inject_context(self.tmpdir, "Fix typo in config.ts")
        self.assertEqual(result["decision"], "skip")

    def test_inject_context_builds_cache_when_missing(self):
        """inject_context should build cache if none exists and prompt is planning-related."""
        # Ensure no cache exists
        self.mod.invalidate_cache(self.tmpdir)
        result = self.mod.inject_context(self.tmpdir, "/design the new API layer")
        self.assertEqual(result["decision"], "inject")
        self.assertIn("context", result)
        self.assertTrue(len(result["context"]) > 0)

    def test_inject_context_output_format(self):
        """inject_context output should be a dict with decision and optional context keys."""
        result = self.mod.inject_context(self.tmpdir, "/plan something")
        self.assertIn("decision", result)
        self.assertIn(result["decision"], ("inject", "skip"))
        if result["decision"] == "inject":
            self.assertIn("context", result)
            self.assertIsInstance(result["context"], str)

    def test_inject_cli_command_exists(self):
        """The 'inject' command should be a valid CLI choice."""
        source = get_source_code()
        # Verify 'inject' is listed in the argparse choices
        self.assertIn("'inject'", source)


if __name__ == "__main__":
    unittest.main()
