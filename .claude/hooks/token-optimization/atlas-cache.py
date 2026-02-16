#!/usr/bin/env python3
"""
Atlas Context Caching

Caches processed atlas context to reduce repeated loading costs.
Supports both local file cache and S3 for distributed caching.

Estimated savings: 60-80% on context load

Usage:
  python atlas-cache.py build [--repo-path PATH]  # Build cache from atlas
  python atlas-cache.py get [--repo-path PATH]    # Get cached context
  python atlas-cache.py inject [--repo-path PATH]  # Inject cached context for PreToolUse hook
  python atlas-cache.py invalidate                 # Invalidate cache
  python atlas-cache.py stats                      # Show cache stats
"""

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import subprocess

# Import shared config loader
sys.path.insert(0, str(Path(__file__).parent))
from config_loader import get_cache_dir, get_s3_bucket, get_atlas_paths, load_config


def _build_config() -> dict:
    """Build CONFIG from project.config.json values."""
    project_config = load_config()
    paths_config = project_config.get("paths", {})
    atlas_dir = paths_config.get("atlas_dir", "docs/atlas")
    context_files = project_config.get("context_files", ["CLAUDE.md"])
    atlas_paths = [atlas_dir] + context_files

    return {
        'cache_dir': get_cache_dir(),
        's3_bucket': get_s3_bucket(),
        's3_prefix': 'atlas-cache',
        'cache_ttl_hours': 24,
        'max_cache_size_mb': 100,
        'atlas_paths': atlas_paths,
        'summary_max_tokens': 500,
        'features_dir': paths_config.get("atlas_features_dir", "docs/atlas/features"),
    }


# Configuration (loaded from project.config.json)
CONFIG = _build_config()


def estimate_tokens(text: str) -> int:
    """Rough token estimate (~1.3 chars per token average)."""
    return len(text) * 10 // 13


def get_repo_hash(repo_path: Path) -> str:
    """Generate a hash identifying the repo."""
    try:
        result = subprocess.run(
            ['git', 'remote', 'get-url', 'origin'],
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            return hashlib.md5(result.stdout.strip().encode()).hexdigest()[:12]
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as e:
        sys.stderr.write(f"Warning: failed to get repo remote URL: {e}\n")
    return hashlib.md5(str(repo_path).encode()).hexdigest()[:12]


def get_commit_sha(repo_path: Path) -> str:
    """Get current commit SHA."""
    try:
        result = subprocess.run(
            ['git', 'rev-parse', 'HEAD'],
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=30
        )
        if result.returncode == 0:
            return result.stdout.strip()[:12]
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as e:
        sys.stderr.write(f"Warning: failed to get commit SHA: {e}\n")
    return 'unknown'


def get_atlas_hash(repo_path: Path) -> str:
    """Generate a hash of all atlas-related files."""
    hasher = hashlib.md5()

    for atlas_path in CONFIG['atlas_paths']:
        full_path = repo_path / atlas_path
        if full_path.is_file():
            hasher.update(full_path.read_bytes())
        elif full_path.is_dir():
            for file in sorted(full_path.rglob('*.md')):
                hasher.update(file.read_bytes())

    return hasher.hexdigest()[:16]


def get_cache_path(repo_path: Path) -> Path:
    """Get the local cache path for a repo."""
    repo_hash = get_repo_hash(repo_path)
    atlas_hash = get_atlas_hash(repo_path)
    return CONFIG['cache_dir'] / repo_hash / f"{atlas_hash}.json"


def load_atlas_features(repo_path: Path) -> List[Dict[str, Any]]:
    """Load all atlas feature files and create summaries."""
    features = []
    atlas_dir = repo_path / CONFIG['features_dir']

    if not atlas_dir.exists():
        return features

    for file in sorted(atlas_dir.glob('*.md')):
        content = file.read_text()
        tokens = estimate_tokens(content)

        # Parse YAML frontmatter if present
        metadata = {}
        if content.startswith('---'):
            parts = content.split('---', 2)
            if len(parts) >= 3:
                try:
                    # Parse simple YAML frontmatter without external deps
                    for line in parts[1].strip().split('\n'):
                        if ':' in line:
                            key, _, val = line.partition(':')
                            metadata[key.strip()] = val.strip().strip('"').strip("'")
                    content = parts[2]
                except (ValueError, IndexError) as e:
                    sys.stderr.write(f"Warning: failed to parse YAML frontmatter: {e}\n")

        # Extract key sections
        lines = content.split('\n')
        title = ''
        description = ''
        key_points = []

        for line in lines:
            if line.startswith('# '):
                title = line[2:].strip()
            elif line.startswith('## ') and 'description' in line.lower():
                # Capture next paragraph as description
                try:
                    idx = lines.index(line)
                except ValueError:
                    sys.stderr.write(f"Warning: could not find line index for '{line[:50]}'\n")
                    continue
                desc_lines = []
                for dl in lines[idx+1:idx+10]:
                    if dl.startswith('#') or dl.strip() == '':
                        if desc_lines:
                            break
                    else:
                        desc_lines.append(dl)
                description = ' '.join(desc_lines)[:300]
            elif line.startswith('- ') and len(key_points) < 5:
                key_points.append(line[2:].strip()[:100])

        # Create summary
        summary = {
            'file': file.name,
            'title': title or metadata.get('title', file.stem),
            'feature_id': metadata.get('id', file.stem),
            'status': metadata.get('status', 'unknown'),
            'description': description[:200] if description else '',
            'key_points': key_points[:3],
            'full_tokens': tokens,
            'summary_tokens': estimate_tokens(json.dumps({
                'title': title,
                'description': description[:200],
                'key_points': key_points[:3]
            }))
        }

        features.append(summary)

    return features


def load_project_context(repo_path: Path) -> Dict[str, Any]:
    """Load and summarize project-level context files."""
    context = {}

    # Load context files from config
    for context_file in CONFIG['atlas_paths']:
        ctx_path = repo_path / context_file
        if ctx_path.is_file():
            content = ctx_path.read_text()
            key = ctx_path.stem.lower().replace('-', '_').replace(' ', '_')
            max_chars = 3000 if 'spec' in key else 2000
            context[key] = {
                'full_tokens': estimate_tokens(content),
                'content': content[:max_chars],
                'summary_tokens': estimate_tokens(content[:max_chars])
            }

    return context


def build_cache(repo_path: Path) -> Dict[str, Any]:
    """Build the atlas cache for a repository."""
    cache_path = get_cache_path(repo_path)
    cache_path.parent.mkdir(parents=True, exist_ok=True)

    # Load features
    features = load_atlas_features(repo_path)

    # Load project context
    project_context = load_project_context(repo_path)

    # Calculate totals
    total_full_tokens = sum(f['full_tokens'] for f in features)
    total_full_tokens += sum(c['full_tokens'] for c in project_context.values())

    total_summary_tokens = sum(f['summary_tokens'] for f in features)
    total_summary_tokens += sum(c['summary_tokens'] for c in project_context.values())

    cache_data = {
        'repo_hash': get_repo_hash(repo_path),
        'commit_sha': get_commit_sha(repo_path),
        'atlas_hash': get_atlas_hash(repo_path),
        'created_at': datetime.now().isoformat(),
        'expires_at': (datetime.now() + timedelta(hours=CONFIG['cache_ttl_hours'])).isoformat(),
        'features': features,
        'project_context': project_context,
        'stats': {
            'feature_count': len(features),
            'total_full_tokens': total_full_tokens,
            'total_summary_tokens': total_summary_tokens,
            'savings_percent': round((1 - total_summary_tokens / max(total_full_tokens, 1)) * 100, 1)
        }
    }

    # Save to local cache
    with open(cache_path, 'w') as f:
        json.dump(cache_data, f, indent=2)

    # Optionally upload to S3
    if CONFIG['s3_bucket']:
        try:
            s3_key = f"{CONFIG['s3_prefix']}/{cache_data['repo_hash']}/{cache_data['atlas_hash']}.json"
            subprocess.run([
                'aws', 's3', 'cp',
                str(cache_path),
                f"s3://{CONFIG['s3_bucket']}/{s3_key}"
            ], capture_output=True, timeout=30)
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as e:
            sys.stderr.write(f"Warning: Failed to upload to S3: {e}\n")

    return cache_data


def get_cache(repo_path: Path) -> Optional[Dict[str, Any]]:
    """Get cached atlas context if available and valid."""
    cache_path = get_cache_path(repo_path)

    if not cache_path.exists():
        # Try to fetch from S3
        if CONFIG['s3_bucket']:
            try:
                repo_hash = get_repo_hash(repo_path)
                atlas_hash = get_atlas_hash(repo_path)
                s3_key = f"{CONFIG['s3_prefix']}/{repo_hash}/{atlas_hash}.json"

                cache_path.parent.mkdir(parents=True, exist_ok=True)
                result = subprocess.run([
                    'aws', 's3', 'cp',
                    f"s3://{CONFIG['s3_bucket']}/{s3_key}",
                    str(cache_path)
                ], capture_output=True, timeout=30)

                if result.returncode != 0:
                    return None
            except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as e:
                sys.stderr.write(f"Warning: failed to fetch cache from S3: {e}\n")
                return None
        else:
            return None

    # Load and validate cache
    try:
        with open(cache_path, 'r') as f:
            cache_data = json.load(f)

        # Check if expired
        expires_at = datetime.fromisoformat(cache_data['expires_at'])
        if datetime.now() > expires_at:
            cache_path.unlink()
            return None

        # Check if atlas has changed
        current_hash = get_atlas_hash(repo_path)
        if cache_data['atlas_hash'] != current_hash:
            cache_path.unlink()
            return None

        return cache_data

    except (json.JSONDecodeError, KeyError, ValueError, OSError) as e:
        sys.stderr.write(f"Warning: failed to load or validate cache: {e}\n")
        return None


# ---------------------------------------------------------------------------
# Tiered cache retrieval based on intent classification
# ---------------------------------------------------------------------------

# Lazy import to avoid circular dependency at module level
_intent_classifier = None


def _get_intent_classifier():
    """Lazy-load intent-classifier.py module."""
    global _intent_classifier
    if _intent_classifier is None:
        import importlib.util
        classifier_path = Path(__file__).parent / "intent-classifier.py"
        spec = importlib.util.spec_from_file_location("intent_classifier", str(classifier_path))
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _intent_classifier = mod
    return _intent_classifier


def _strip_feature_to_summary(feature: Dict[str, Any]) -> Dict[str, Any]:
    """Return a lightweight summary of a feature (title + feature_id + status only)."""
    return {
        'file': feature.get('file', ''),
        'title': feature.get('title', ''),
        'feature_id': feature.get('feature_id', ''),
        'status': feature.get('status', ''),
        'summary_tokens': feature.get('summary_tokens', 0),
    }


def get_tiered_cache(repo_path: Path, prompt: str = "") -> Optional[Dict[str, Any]]:
    """
    Get cached atlas context at a detail level appropriate for the task.

    Uses intent classification to determine how much context to return:
      - ultra_light / light: summary-only (feature titles + IDs, no descriptions)
      - medium: standard cache (summaries with descriptions and key points)
      - heavy / ultra_heavy: full cache (all available detail)

    Args:
        repo_path: Path to the repository.
        prompt: The user prompt or skill invocation to classify.

    Returns:
        Cache data dict (possibly trimmed) or None if no cache available.
    """
    cache_data = get_cache(repo_path)
    if cache_data is None:
        return None

    # Classify intent
    try:
        classifier = _get_intent_classifier()
        intent = classifier.classify_intent(prompt)
        level = intent.get("level", "medium")
    except (ImportError, AttributeError, OSError) as e:
        sys.stderr.write(f"atlas-cache: intent classification failed, returning full cache: {e}\n")
        level = "medium"

    # For heavy/ultra_heavy, return everything
    if level in ("heavy", "ultra_heavy"):
        cache_data_copy = dict(cache_data)
        cache_data_copy["_tier"] = "full"
        cache_data_copy["_intent_level"] = level
        return cache_data_copy

    # For medium, return standard cache as-is
    if level == "medium":
        cache_data_copy = dict(cache_data)
        cache_data_copy["_tier"] = "standard"
        cache_data_copy["_intent_level"] = level
        return cache_data_copy

    # For ultra_light / light, return summary-only (stripped features)
    cache_data_copy = dict(cache_data)
    cache_data_copy["_tier"] = "summary"
    cache_data_copy["_intent_level"] = level

    # Strip features to lightweight summaries
    if "features" in cache_data_copy:
        cache_data_copy["features"] = [
            _strip_feature_to_summary(f) for f in cache_data_copy["features"]
        ]

    # Strip project_context to just keys and token counts
    if "project_context" in cache_data_copy:
        trimmed_context = {}
        for key, ctx in cache_data_copy["project_context"].items():
            trimmed_context[key] = {
                'full_tokens': ctx.get('full_tokens', 0),
                'summary_tokens': ctx.get('summary_tokens', 0),
            }
        cache_data_copy["project_context"] = trimmed_context

    return cache_data_copy


# ---------------------------------------------------------------------------
# Planning-prompt detection and context injection for PreToolUse hooks
# ---------------------------------------------------------------------------

# Patterns that indicate a planning or architecture-related task
_PLANNING_PATTERNS = [
    r"/plan\b",
    r"/design\b",
    r"/dd\b",
    r"/confidence-check\b",
    r"/correct-course\b",
    r"\barchitecture\b",
    r"\bsystem[\s-]?design\b",
    r"\btechnical[\s-]?design\b",
    r"\bdecompos(?:e|ition)\b",
    r"\bimpact[\s-]?analysis\b",
    r"\bdependency[\s-]?graph\b",
    r"\bfeature[\s-]?atlas\b",
]

def is_planning_prompt(prompt: str) -> bool:
    """
    Detect whether a prompt is planning or architecture-related.

    Returns True if the prompt matches any planning pattern.
    """
    if not prompt or not prompt.strip():
        return False
    for pattern in _PLANNING_PATTERNS:
        if re.search(pattern, prompt, re.IGNORECASE):
            return True
    return False


def _format_cache_as_context(cache_data: Dict[str, Any]) -> str:
    """Format cached atlas data as a concise context string for injection."""
    lines = ["## Atlas Architecture Context (auto-injected)"]

    features = cache_data.get("features", [])
    if features:
        lines.append("")
        lines.append(f"### Features ({len(features)} total)")
        for f in features:
            title = f.get("title", f.get("file", "unknown"))
            status = f.get("status", "")
            desc = f.get("description", "")
            line = f"- **{title}**"
            if status and status != "unknown":
                line += f" [{status}]"
            if desc:
                line += f": {desc[:120]}"
            lines.append(line)

    stats = cache_data.get("stats", {})
    if stats:
        lines.append("")
        lines.append(f"_Atlas: {stats.get('feature_count', 0)} features, "
                      f"{stats.get('total_summary_tokens', 0):,} summary tokens_")

    return "\n".join(lines)


def inject_context(repo_path: Path, prompt: str) -> Dict[str, Any]:
    """
    Determine whether to inject atlas context for a given prompt.

    If the prompt is planning-related, returns the cached atlas summary
    for injection into the agent context. Builds cache first if needed.

    Args:
        repo_path: Path to the repository.
        prompt: The task prompt from the hook input.

    Returns:
        Dict with 'decision' ('inject' or 'skip') and optional 'context' string.
    """
    if not is_planning_prompt(prompt):
        return {"decision": "skip"}

    # Try to get existing cache
    cache_data = get_cache(repo_path)
    if cache_data is None:
        # Build cache on demand
        cache_data = build_cache(repo_path)

    context_text = _format_cache_as_context(cache_data)
    return {
        "decision": "inject",
        "context": context_text,
    }


def invalidate_cache(repo_path: Path):
    """Invalidate the cache for a repository."""
    cache_path = get_cache_path(repo_path)
    if cache_path.exists():
        cache_path.unlink()

    # Also invalidate S3 if configured
    if CONFIG['s3_bucket']:
        try:
            repo_hash = get_repo_hash(repo_path)
            subprocess.run([
                'aws', 's3', 'rm',
                f"s3://{CONFIG['s3_bucket']}/{CONFIG['s3_prefix']}/{repo_hash}/",
                '--recursive'
            ], capture_output=True, timeout=30)
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as e:
            sys.stderr.write(f"Warning: failed to invalidate S3 cache: {e}\n")


def get_stats() -> Dict[str, Any]:
    """Get cache statistics."""
    stats = {
        'cache_dir': str(CONFIG['cache_dir']),
        's3_bucket': CONFIG['s3_bucket'] or 'not configured',
        'cached_repos': 0,
        'total_cache_size_mb': 0
    }

    if CONFIG['cache_dir'].exists():
        for repo_dir in CONFIG['cache_dir'].iterdir():
            if repo_dir.is_dir():
                stats['cached_repos'] += 1
                for cache_file in repo_dir.glob('*.json'):
                    stats['total_cache_size_mb'] += cache_file.stat().st_size / (1024 * 1024)

    stats['total_cache_size_mb'] = round(stats['total_cache_size_mb'], 2)
    return stats


def main():
    parser = argparse.ArgumentParser(description='Atlas Context Cache Manager')
    parser.add_argument('command', choices=['build', 'get', 'inject', 'invalidate', 'stats'],
                       help='Command to execute')
    parser.add_argument('--repo-path', type=Path, default=Path.cwd(),
                       help='Path to the repository')
    parser.add_argument('--format', choices=['json', 'summary'], default='json',
                       help='Output format')
    parser.add_argument('--prompt', type=str, default='',
                       help='Task prompt for tiered cache retrieval (used with get/inject)')

    args = parser.parse_args()

    if args.command == 'build':
        cache_data = build_cache(args.repo_path)
        if args.format == 'json':
            print(json.dumps(cache_data, indent=2))
        else:
            stats = cache_data['stats']
            print(f"Atlas cache built:")
            print(f"  Features: {stats['feature_count']}")
            print(f"  Full tokens: {stats['total_full_tokens']:,}")
            print(f"  Summary tokens: {stats['total_summary_tokens']:,}")
            print(f"  Savings: {stats['savings_percent']}%")

    elif args.command == 'get':
        # Use tiered retrieval when a prompt is provided
        if args.prompt:
            cache_data = get_tiered_cache(args.repo_path, args.prompt)
        else:
            cache_data = get_cache(args.repo_path)
        if cache_data:
            if args.format == 'json':
                print(json.dumps(cache_data, indent=2))
            else:
                tier = cache_data.get('_tier', 'standard')
                print(f"Cache hit! Created: {cache_data['created_at']} (tier: {tier})")
                print(f"  Features: {cache_data['stats']['feature_count']}")
                print(f"  Savings: {cache_data['stats']['savings_percent']}%")
        else:
            print("Cache miss - no valid cache found")
            sys.exit(1)

    elif args.command == 'inject':
        # Read hook input from stdin for prompt extraction
        prompt = args.prompt
        if not prompt:
            try:
                stdin_data = sys.stdin.read()
                if stdin_data.strip():
                    hook_input = json.loads(stdin_data)
                    tool_input = hook_input.get("tool_input", {})
                    if isinstance(tool_input, dict):
                        prompt = tool_input.get("prompt", "")
                    else:
                        prompt = str(tool_input)
            except (json.JSONDecodeError, EOFError, OSError) as e:
                sys.stderr.write(f"atlas-cache inject: failed to read stdin: {e}\n")

        result = inject_context(args.repo_path, prompt)
        print(json.dumps(result))

    elif args.command == 'invalidate':
        invalidate_cache(args.repo_path)
        print("Cache invalidated")

    elif args.command == 'stats':
        stats = get_stats()
        print(json.dumps(stats, indent=2))


if __name__ == '__main__':
    main()