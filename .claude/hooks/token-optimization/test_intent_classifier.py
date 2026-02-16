#!/usr/bin/env python3
"""Tests for intent-classifier.py -- 5-layer progressive context loading."""

import importlib.util
import sys
import unittest
from pathlib import Path


def load_module():
    """Load intent-classifier.py as a module (hyphenated name)."""
    script_path = Path(__file__).parent / "intent-classifier.py"
    spec = importlib.util.spec_from_file_location("intent_classifier", str(script_path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


MOD = load_module()


class TestClassifyIntentReturnShape(unittest.TestCase):
    """Verify the returned dict always has the expected keys and types."""

    def _assert_valid_result(self, result):
        self.assertIn("level", result)
        self.assertIn("token_budget", result)
        self.assertIn("description", result)
        self.assertIsInstance(result["level"], str)
        self.assertIsInstance(result["token_budget"], int)
        self.assertIsInstance(result["description"], str)
        self.assertIn(result["level"], MOD.INTENT_LEVELS)

    def test_empty_string(self):
        result = MOD.classify_intent("")
        self._assert_valid_result(result)
        self.assertEqual(result["level"], "medium")

    def test_none_input(self):
        result = MOD.classify_intent(None)
        self._assert_valid_result(result)
        self.assertEqual(result["level"], "medium")

    def test_whitespace_only(self):
        result = MOD.classify_intent("   ")
        self._assert_valid_result(result)
        self.assertEqual(result["level"], "medium")

    def test_arbitrary_string(self):
        result = MOD.classify_intent("do something interesting with the codebase")
        self._assert_valid_result(result)


class TestUltraLightClassification(unittest.TestCase):
    """Ultra-light: status checks, progress queries (100-500 tokens)."""

    def test_status_skill(self):
        result = MOD.classify_intent("/status")
        self.assertEqual(result["level"], "ultra_light")

    def test_progress_check(self):
        result = MOD.classify_intent("check progress")
        self.assertEqual(result["level"], "ultra_light")

    def test_status_question(self):
        result = MOD.classify_intent("what's the status of the build?")
        self.assertEqual(result["level"], "ultra_light")

    def test_heartbeat(self):
        result = MOD.classify_intent("heartbeat")
        self.assertEqual(result["level"], "ultra_light")

    def test_version_check(self):
        result = MOD.classify_intent("version")
        self.assertEqual(result["level"], "ultra_light")

    def test_check_version(self):
        result = MOD.classify_intent("check version of node")
        self.assertEqual(result["level"], "ultra_light")

    def test_which_branch(self):
        result = MOD.classify_intent("which branch am I on?")
        self.assertEqual(result["level"], "ultra_light")

    def test_token_budget_range(self):
        result = MOD.classify_intent("/status")
        self.assertGreaterEqual(result["token_budget"], 100)
        self.assertLessEqual(result["token_budget"], 500)


class TestLightClassification(unittest.TestCase):
    """Light: typo fix, small change (500-2K tokens)."""

    def test_typo_fix(self):
        result = MOD.classify_intent("fix typo in readme")
        self.assertEqual(result["level"], "light")

    def test_rename(self):
        result = MOD.classify_intent("rename variable foo to bar")
        self.assertEqual(result["level"], "light")

    def test_lint_fix(self):
        result = MOD.classify_intent("fix lint errors")
        self.assertEqual(result["level"], "light")

    def test_cleanup(self):
        result = MOD.classify_intent("cleanup unused imports")
        self.assertEqual(result["level"], "light")

    def test_remove_unused(self):
        result = MOD.classify_intent("remove unused variables")
        self.assertEqual(result["level"], "light")

    def test_bump_version(self):
        result = MOD.classify_intent("bump version to 2.0.1")
        self.assertEqual(result["level"], "light")

    def test_formatting(self):
        result = MOD.classify_intent("fix formatting in config.py")
        self.assertEqual(result["level"], "light")

    def test_short_prompt_heuristic(self):
        """Very short prompts without keywords default to light."""
        result = MOD.classify_intent("fix it")
        self.assertEqual(result["level"], "light")

    def test_token_budget_range(self):
        result = MOD.classify_intent("fix typo")
        self.assertGreaterEqual(result["token_budget"], 500)
        self.assertLessEqual(result["token_budget"], 2000)


class TestMediumClassification(unittest.TestCase):
    """Medium: bug fix, single feature (2-5K tokens)."""

    def test_eval_skill(self):
        result = MOD.classify_intent("/eval 42")
        self.assertEqual(result["level"], "medium")

    def test_bug_skill(self):
        result = MOD.classify_intent("/bug fix login error")
        self.assertEqual(result["level"], "medium")

    def test_tdd_skill(self):
        result = MOD.classify_intent("/tdd-discipline implement feature")
        self.assertEqual(result["level"], "medium")

    def test_design_skill(self):
        result = MOD.classify_intent("/design new auth flow")
        self.assertEqual(result["level"], "medium")

    def test_plan_skill(self):
        result = MOD.classify_intent("/plan migration steps")
        self.assertEqual(result["level"], "medium")

    def test_code_review_skill(self):
        result = MOD.classify_intent("/code-review PR 123")
        self.assertEqual(result["level"], "medium")

    def test_moderate_length_prompt(self):
        """Moderate prompts without keywords default to medium."""
        result = MOD.classify_intent(
            "add a new endpoint for user profiles that returns JSON data"
        )
        self.assertEqual(result["level"], "medium")

    def test_token_budget_range(self):
        result = MOD.classify_intent("/eval 42")
        self.assertGreaterEqual(result["token_budget"], 2000)
        self.assertLessEqual(result["token_budget"], 5000)


class TestHeavyClassification(unittest.TestCase):
    """Heavy: large feature, refactor (5-20K tokens)."""

    def test_refactor(self):
        result = MOD.classify_intent("refactor the authentication module")
        self.assertEqual(result["level"], "heavy")

    def test_migration(self):
        result = MOD.classify_intent("migrate database from postgres to dynamodb")
        self.assertEqual(result["level"], "heavy")

    def test_rewrite(self):
        result = MOD.classify_intent("rewrite the notification service")
        self.assertEqual(result["level"], "heavy")

    def test_integration(self):
        result = MOD.classify_intent("integrate stripe payment processing")
        self.assertEqual(result["level"], "heavy")

    def test_build_skill(self):
        result = MOD.classify_intent("/build issue 42")
        self.assertEqual(result["level"], "heavy")

    def test_scrum_skill(self):
        result = MOD.classify_intent("/scrum process queue")
        self.assertEqual(result["level"], "heavy")

    def test_feature_dev_skill(self):
        result = MOD.classify_intent("/feature-dev new dashboard")
        self.assertEqual(result["level"], "heavy")

    def test_infrastructure(self):
        result = MOD.classify_intent("set up infrastructure for new service")
        self.assertEqual(result["level"], "heavy")

    def test_long_prompt_heuristic(self):
        """Long prompts without specific keywords default to heavy."""
        long_prompt = " ".join(["implement"] + ["complex task word"] * 30)
        result = MOD.classify_intent(long_prompt)
        self.assertEqual(result["level"], "heavy")

    def test_token_budget_range(self):
        result = MOD.classify_intent("refactor the auth module")
        self.assertGreaterEqual(result["token_budget"], 5000)
        self.assertLessEqual(result["token_budget"], 20000)


class TestUltraHeavyClassification(unittest.TestCase):
    """Ultra-heavy: system redesign (20K+ tokens)."""

    def test_redesign(self):
        result = MOD.classify_intent("redesign the entire deployment pipeline")
        self.assertEqual(result["level"], "ultra_heavy")

    def test_architecture(self):
        result = MOD.classify_intent("new architecture for the platform")
        self.assertEqual(result["level"], "ultra_heavy")

    def test_system_wide(self):
        result = MOD.classify_intent("system-wide logging overhaul")
        self.assertEqual(result["level"], "ultra_heavy")

    def test_full_rewrite(self):
        result = MOD.classify_intent("full rewrite of the backend")
        self.assertEqual(result["level"], "ultra_heavy")

    def test_microservice(self):
        result = MOD.classify_intent("convert to microservice architecture")
        self.assertEqual(result["level"], "ultra_heavy")

    def test_from_scratch(self):
        result = MOD.classify_intent("build the dashboard from scratch")
        self.assertEqual(result["level"], "ultra_heavy")

    def test_token_budget_range(self):
        result = MOD.classify_intent("redesign the system")
        self.assertGreaterEqual(result["token_budget"], 20000)


class TestGetIntentLevels(unittest.TestCase):
    """Test the get_intent_levels helper."""

    def test_returns_all_five_levels(self):
        levels = MOD.get_intent_levels()
        expected = {"ultra_light", "light", "medium", "heavy", "ultra_heavy"}
        self.assertEqual(set(levels.keys()), expected)

    def test_each_level_has_budget_and_description(self):
        levels = MOD.get_intent_levels()
        for name, info in levels.items():
            self.assertIn("token_budget", info, f"{name} missing token_budget")
            self.assertIn("description", info, f"{name} missing description")
            self.assertIsInstance(info["token_budget"], int)
            self.assertIsInstance(info["description"], str)

    def test_budgets_are_ascending(self):
        levels = MOD.get_intent_levels()
        order = ["ultra_light", "light", "medium", "heavy", "ultra_heavy"]
        budgets = [levels[l]["token_budget"] for l in order]
        for i in range(len(budgets) - 1):
            self.assertLess(
                budgets[i], budgets[i + 1],
                f"Budget for {order[i]} ({budgets[i]}) should be less than {order[i+1]} ({budgets[i+1]})"
            )


class TestCaseInsensitivity(unittest.TestCase):
    """Pattern matching should be case-insensitive."""

    def test_uppercase_status(self):
        result = MOD.classify_intent("STATUS check")
        self.assertEqual(result["level"], "ultra_light")

    def test_mixed_case_refactor(self):
        result = MOD.classify_intent("REFACTOR the auth module")
        self.assertEqual(result["level"], "heavy")

    def test_mixed_case_redesign(self):
        result = MOD.classify_intent("Redesign the system")
        self.assertEqual(result["level"], "ultra_heavy")


class TestEdgeCases(unittest.TestCase):
    """Edge cases and priority ordering."""

    def test_ultra_heavy_wins_over_heavy(self):
        """When both heavy and ultra-heavy patterns match, ultra-heavy wins."""
        result = MOD.classify_intent("redesign and refactor the entire platform")
        self.assertEqual(result["level"], "ultra_heavy")

    def test_skill_prefix_with_args(self):
        """Skill invocations with arguments should still classify correctly."""
        result = MOD.classify_intent("/eval fix the login bug in auth.py")
        self.assertEqual(result["level"], "medium")

    def test_multiline_prompt(self):
        """Multi-line prompts should be handled."""
        prompt = "fix the typo\nin the config file\non line 42"
        result = MOD.classify_intent(prompt)
        self.assertEqual(result["level"], "light")


if __name__ == "__main__":
    unittest.main()
