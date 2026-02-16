#!/usr/bin/env python3
"""
Shared config loader for token-optimization hooks.
Reads project.config.json and provides project-specific values.
"""

import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional


def get_project_dir() -> Path:
    """Get project directory from env or detect from file location."""
    if "CLAUDE_PROJECT_DIR" in os.environ:
        return Path(os.environ["CLAUDE_PROJECT_DIR"])
    # Fall back: walk up from this file
    return Path(__file__).parent.parent.parent


def load_config() -> Dict[str, Any]:
    """Load project.config.json, returning empty dict if not found."""
    config_path = get_project_dir() / ".claude" / "project.config.json"
    if config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            print(f"config_loader: failed to load config: {e}", file=sys.stderr)
    return {}


def get_cache_prefix() -> str:
    """Get the cache directory prefix from config."""
    config = load_config()
    return config.get("token_optimization", {}).get("cache_prefix", "claude-project")


def get_state_dir() -> Path:
    """Get temp state directory, using config prefix for namespacing."""
    prefix = get_cache_prefix()
    return Path(tempfile.gettempdir()) / f"{prefix}-token-optimization"


def get_cache_dir() -> Path:
    """Get atlas cache directory, using config prefix for namespacing."""
    prefix = get_cache_prefix()
    return Path(tempfile.gettempdir()) / f"{prefix}-atlas-cache"


def get_s3_bucket() -> str:
    """Get S3 bucket from env var specified in config."""
    config = load_config()
    env_var = config.get("token_optimization", {}).get("s3_bucket_env_var", "CLAUDE_ATLAS_CACHE_BUCKET")
    return os.environ.get(env_var, "")


def get_atlas_paths() -> list:
    """Get list of atlas context file paths from config."""
    config = load_config()
    return config.get("context_files", ["CLAUDE.md"])


def get_config_value(key_path: str, default: Any = None) -> Any:
    """
    Get a nested config value using dot notation.
    Example: get_config_value("github.labels.build", "build")
    """
    config = load_config()
    keys = key_path.split(".")
    value = config
    for key in keys:
        if isinstance(value, dict):
            value = value.get(key)
        else:
            return default
    return value if value is not None else default
