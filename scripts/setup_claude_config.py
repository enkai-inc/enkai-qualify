#!/usr/bin/env python3
"""
Setup script for .claude/project.config.json

Run this after copying .claude/ into a new repository to configure
project-specific values.

Usage:
    python scripts/setup_claude_config.py [--non-interactive]

Options:
    --non-interactive  Auto-detect values without prompting
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


def get_project_root() -> Path:
    """Get project root (parent of scripts/)."""
    return Path(__file__).parent.parent


def get_config_path() -> Path:
    """Get path to project.config.json."""
    return get_project_root() / ".claude" / "project.config.json"


def load_config() -> dict:
    """Load existing config."""
    config_path = get_config_path()
    if config_path.exists():
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_config(config: dict) -> None:
    """Save config to file."""
    config_path = get_config_path()
    config_path.parent.mkdir(parents=True, exist_ok=True)
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
    print(f"Saved: {config_path}")


def detect_git_info() -> dict:
    """Auto-detect project info from git."""
    info = {"name": "", "repo_owner": "", "repo_name": ""}

    try:
        # Get remote URL
        result = subprocess.run(
            ["git", "remote", "get-url", "origin"],
            capture_output=True, text=True, cwd=get_project_root()
        )
        if result.returncode == 0:
            url = result.stdout.strip()
            # Parse owner/repo from URL
            # Handles: https://github.com/owner/repo.git, git@github.com:owner/repo.git
            match = re.search(r"[:/]([^/]+)/([^/]+?)(?:\.git)?$", url)
            if match:
                info["repo_owner"] = match.group(1)
                info["repo_name"] = match.group(2)
                info["name"] = match.group(2)
    except (subprocess.CalledProcessError, FileNotFoundError, OSError) as e:
        print(f"setup_claude_config: git detection failed: {e}", file=sys.stderr)

    # Fallback to directory name
    if not info["name"]:
        info["name"] = get_project_root().name

    return info


def detect_paths() -> dict:
    """Detect common paths in the project."""
    root = get_project_root()
    paths = {}

    # Check for common directory structures
    if (root / "docs" / "atlas").exists():
        paths["atlas_dir"] = "docs/atlas"
        paths["atlas_features_dir"] = "docs/atlas/features"
    elif (root / "docs").exists():
        paths["docs_root"] = "docs"

    if (root / "src").exists():
        paths["src_dir"] = "src"

    if (root / "dashboard").exists():
        paths["dashboard_dir"] = "dashboard"
    elif (root / "frontend").exists():
        paths["dashboard_dir"] = "frontend"
    elif (root / "web").exists():
        paths["dashboard_dir"] = "web"

    if (root / "builder").exists():
        paths["builder_dir"] = "builder"
    elif (root / "backend").exists():
        paths["builder_dir"] = "backend"
    elif (root / "api").exists():
        paths["builder_dir"] = "api"

    if (root / "infra" / "cdk").exists():
        paths["infra_dir"] = "infra/cdk"
    elif (root / "infrastructure").exists():
        paths["infra_dir"] = "infrastructure"
    elif (root / "terraform").exists():
        paths["infra_dir"] = "terraform"

    return paths


def detect_context_files() -> list:
    """Detect which context files exist."""
    root = get_project_root()
    possible = ["CLAUDE.md", "PROJECT_SPEC.md", "MILESTONES.md", "README.md"]
    return [f for f in possible if (root / f).exists()]


def prompt(message: str, default: str = "", required: bool = False) -> str:
    """Prompt user for input with default value."""
    if default:
        full_prompt = f"{message} [{default}]: "
    else:
        full_prompt = f"{message}: "

    while True:
        value = input(full_prompt).strip()
        if not value:
            value = default
        if value or not required:
            return value
        print("  This field is required.")


def run_interactive(config: dict) -> dict:
    """Run interactive setup."""
    print("\n=== Claude Code Project Configuration ===\n")

    # Auto-detect values
    git_info = detect_git_info()
    detected_paths = detect_paths()
    context_files = detect_context_files()

    # Project section
    print("PROJECT INFO")
    print("-" * 40)

    project = config.get("project", {})
    project["name"] = prompt("Project name", git_info.get("name", project.get("name", "")))
    project["display_name"] = prompt("Display name", project.get("display_name", project["name"].replace("-", " ").title()))
    project["repo_owner"] = prompt("GitHub owner", git_info.get("repo_owner", project.get("repo_owner", "")))
    project["repo_name"] = prompt("GitHub repo", git_info.get("repo_name", project.get("repo_name", project["name"])))
    config["project"] = project

    # Paths section
    print("\nPATHS (press Enter to accept defaults)")
    print("-" * 40)

    paths = config.get("paths", {})
    if detected_paths.get("atlas_dir"):
        print(f"  Detected atlas: {detected_paths['atlas_dir']}")
        paths["atlas_dir"] = detected_paths["atlas_dir"]
        paths["atlas_features_dir"] = detected_paths.get("atlas_features_dir", paths["atlas_dir"] + "/features")

    if detected_paths.get("dashboard_dir"):
        paths["dashboard_dir"] = prompt("Frontend/dashboard dir", detected_paths["dashboard_dir"])

    if detected_paths.get("builder_dir"):
        paths["builder_dir"] = prompt("Backend/builder dir", detected_paths["builder_dir"])

    if detected_paths.get("infra_dir"):
        paths["infra_dir"] = prompt("Infrastructure dir", detected_paths["infra_dir"])

    config["paths"] = paths

    # Context files
    if context_files:
        print(f"\n  Detected context files: {', '.join(context_files)}")
        config["context_files"] = context_files

    # GitHub labels
    print("\nGITHUB LABELS (customize your label naming)")
    print("-" * 40)

    github = config.get("github", {})
    labels = github.get("labels", {})
    prefix = prompt("Label prefix (e.g., 'myapp' for 'myapp:build')", project["name"])
    labels["build"] = f"{prefix}:build"
    labels["in_progress"] = f"{prefix}:in-progress"
    labels["needs_human"] = f"{prefix}:needs-human"
    github["labels"] = labels
    config["github"] = github

    # Token optimization
    print("\nTOKEN OPTIMIZATION")
    print("-" * 40)

    token_opt = config.get("token_optimization", {})
    token_opt["cache_prefix"] = prompt("Cache prefix (for temp files)", project["name"])
    config["token_optimization"] = token_opt

    # AWS (optional)
    print("\nAWS CONFIGURATION (optional, press Enter to skip)")
    print("-" * 40)

    aws = config.get("aws", {})
    stack_prefix = prompt("AWS stack prefix", aws.get("stack_prefix", ""))
    if stack_prefix:
        aws["stack_prefix"] = stack_prefix
        aws["region"] = prompt("AWS region", aws.get("region", "us-east-1"))
    config["aws"] = aws

    # Secrets (optional)
    secrets = config.get("secrets", {})
    secrets["prefix"] = prompt("Secrets Manager prefix", project["name"])
    config["secrets"] = secrets

    return config


def run_auto(config: dict) -> dict:
    """Run non-interactive auto-detection."""
    print("Auto-detecting configuration...")

    git_info = detect_git_info()
    detected_paths = detect_paths()
    context_files = detect_context_files()

    # Update project
    project = config.get("project", {})
    project["name"] = git_info.get("name", project.get("name", "my-project"))
    project["display_name"] = project["name"].replace("-", " ").title()
    project["repo_owner"] = git_info.get("repo_owner", project.get("repo_owner", ""))
    project["repo_name"] = git_info.get("repo_name", project.get("repo_name", project["name"]))
    config["project"] = project

    # Update paths
    paths = config.get("paths", {})
    paths.update(detected_paths)
    config["paths"] = paths

    # Update context files
    if context_files:
        config["context_files"] = context_files

    # Update labels with project prefix
    github = config.get("github", {})
    labels = github.get("labels", {})
    prefix = project["name"]
    labels["build"] = f"{prefix}:build"
    labels["in_progress"] = f"{prefix}:in-progress"
    labels["needs_human"] = f"{prefix}:needs-human"
    github["labels"] = labels
    config["github"] = github

    # Update cache prefix
    token_opt = config.get("token_optimization", {})
    token_opt["cache_prefix"] = project["name"]
    config["token_optimization"] = token_opt

    # Update secrets prefix
    secrets = config.get("secrets", {})
    secrets["prefix"] = project["name"]
    config["secrets"] = secrets

    return config


def print_summary(config: dict) -> None:
    """Print configuration summary."""
    print("\n=== Configuration Summary ===\n")

    project = config.get("project", {})
    print(f"Project: {project.get('display_name', 'N/A')}")
    print(f"  Repo: {project.get('repo_owner', '?')}/{project.get('repo_name', '?')}")

    paths = config.get("paths", {})
    if paths.get("atlas_dir"):
        print(f"  Atlas: {paths['atlas_dir']}")

    github = config.get("github", {})
    labels = github.get("labels", {})
    if labels:
        print(f"  Labels: {labels.get('build', 'N/A')}, {labels.get('in_progress', 'N/A')}")

    context_files = config.get("context_files", [])
    if context_files:
        print(f"  Context files: {', '.join(context_files)}")

    print()


def main():
    parser = argparse.ArgumentParser(description="Setup .claude/project.config.json")
    parser.add_argument("--non-interactive", "-n", action="store_true",
                        help="Auto-detect values without prompting")
    args = parser.parse_args()

    # Check if config exists
    config_path = get_config_path()
    if not config_path.exists():
        print(f"Error: {config_path} not found.")
        print("Make sure you've copied .claude/ into this repository.")
        sys.exit(1)

    # Load existing config
    config = load_config()

    # Run setup
    if args.non_interactive:
        config = run_auto(config)
    else:
        config = run_interactive(config)

    # Print summary
    print_summary(config)

    # Save
    if args.non_interactive:
        save_config(config)
    else:
        confirm = input("Save configuration? [Y/n]: ").strip().lower()
        if confirm in ("", "y", "yes"):
            save_config(config)
        else:
            print("Configuration not saved.")


if __name__ == "__main__":
    main()
