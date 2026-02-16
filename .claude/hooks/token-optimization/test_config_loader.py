#!/usr/bin/env python3
"""Tests for config_loader.py robustness improvements."""

import ast
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT_PATH = Path(__file__).parent / "config_loader.py"
HOOKS_JSON_PATH = Path(__file__).parent.parent / "hooks.json"


def get_source_code():
    """Read the raw source code of config_loader.py."""
    return SCRIPT_PATH.read_text()


def parse_ast():
    """Parse config_loader.py into an AST."""
    source = get_source_code()
    return ast.parse(source)


class TestHooksJsonValid(unittest.TestCase):
    """Verify hooks.json is valid and has no dead references."""

    def test_hooks_json_is_valid(self):
        """hooks.json must be valid JSON."""
        with open(HOOKS_JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.assertIsInstance(data, list)

    def test_no_typecheck_after_edit_reference(self):
        """hooks.json must not reference the non-existent typecheck-after-edit.sh."""
        content = HOOKS_JSON_PATH.read_text()
        self.assertNotIn(
            "typecheck-after-edit",
            content,
            "hooks.json still references the dead typecheck-after-edit.sh script",
        )


class TestConfigLoaderStderrLogging(unittest.TestCase):
    """load_config() exception handler must log to stderr."""

    def test_except_block_logs_to_stderr(self):
        """The except block in load_config() should print to stderr, not silently pass."""
        source = get_source_code()
        tree = parse_ast()

        # Find the load_config function
        load_config_func = None
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == "load_config":
                load_config_func = node
                break

        self.assertIsNotNone(load_config_func, "load_config function not found")

        # Find try/except blocks inside load_config
        for node in ast.walk(load_config_func):
            if isinstance(node, ast.Try):
                for handler in node.handlers:
                    # The handler should NOT be just 'pass'
                    is_just_pass = (
                        len(handler.body) == 1
                        and isinstance(handler.body[0], ast.Pass)
                    )
                    self.assertFalse(
                        is_just_pass,
                        f"Exception handler at line {handler.lineno} is just 'pass'. "
                        f"Should log to stderr.",
                    )

    def test_except_block_captures_exception(self):
        """The except block in load_config() should capture the exception as a variable."""
        tree = parse_ast()

        load_config_func = None
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == "load_config":
                load_config_func = node
                break

        self.assertIsNotNone(load_config_func, "load_config function not found")

        for node in ast.walk(load_config_func):
            if isinstance(node, ast.Try):
                for handler in node.handlers:
                    self.assertIsNotNone(
                        handler.name,
                        f"Exception handler at line {handler.lineno} does not "
                        f"capture the exception variable (use 'as e').",
                    )


class TestConfigLoaderDocstrings(unittest.TestCase):
    """All public functions in config_loader.py must have docstrings."""

    def test_all_functions_have_docstrings(self):
        """Every function in config_loader.py should have a docstring."""
        tree = parse_ast()
        missing_docstrings = []

        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                # Check for docstring (first statement is a string expression)
                has_docstring = (
                    node.body
                    and isinstance(node.body[0], ast.Expr)
                    and isinstance(node.body[0].value, ast.Constant)
                    and isinstance(node.body[0].value.value, str)
                )
                if not has_docstring:
                    missing_docstrings.append(node.name)

        self.assertEqual(
            missing_docstrings,
            [],
            f"Functions missing docstrings: {missing_docstrings}",
        )


if __name__ == "__main__":
    unittest.main()
