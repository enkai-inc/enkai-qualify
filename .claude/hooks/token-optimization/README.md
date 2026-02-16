# Token Optimization Hooks

This directory contains hooks and utilities for reducing token usage in Claude Code sessions.

## Hook Lifecycle

Hooks cover the full Claude Code session lifecycle:

```
UserPromptSubmit          PostToolUse / PreToolUse           Stop
     |                          |                             |
     v                          v                             v
context-loader.py     compress-test-output.py        session-stop.py
 (mode switching,      atlas-cache.py                (session summary,
  skill detection)     context-compaction.py          handoff capture,
                                                      stats persistence)
```

| Phase | Hook | Script | Purpose |
|-------|------|--------|---------|
| **UserPromptSubmit** | On every prompt | `context-loader.py` | Context mode switching, skill activation detection |
| **PreToolUse** | Before Task tool | `atlas-cache.py` | Inject cached atlas context |
| **PostToolUse** | After Bash tool | `compress-test-output.py` | Compress verbose test outputs |
| **Stop** | Session end | `session-stop.py` | Session summary, handoff metadata, stats persistence |

## Overview

| Utility | Purpose | Savings |
|---------|---------|---------|
| `compress-test-output.py` | Compress verbose test outputs | 10-30% |
| `atlas-cache.py` | Cache atlas context | 60-80% |
| `context-compaction.py` | Compact large tool outputs into structured summaries | 40-70% |
| `session-stop.py` | Session summary and handoff capture at stop | (tracking) |
| `analyze-session-tokens.py` | Per-agent token usage and cost analysis | (visibility) |

## Installation

Add these hooks to your `.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/context-loader.py",
            "timeout": 5000
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/token-optimization/compress-test-output.py",
            "timeout": 5000
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/token-optimization/atlas-cache.py get --repo-path \"$CLAUDE_PROJECT_DIR\" --format summary",
            "timeout": 5000
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/token-optimization/session-stop.py",
            "timeout": 10000
          }
        ]
      }
    ]
  }
}
```

## Usage

### Context Loader (UserPromptSubmit)

Detects skill invocations (`/eval`, `/build`, `/dd`, etc.) and injects the appropriate context mode (dev, research, review). Reduces per-session token usage by loading only relevant behavioral rules.

```bash
# Triggered automatically on every user prompt submission
# Maps skills to context modes:
#   /eval, /build, /bug      -> dev mode
#   /dd, /design, /idea      -> research mode
#   /code-review, /critic    -> review mode
```

### Test Output Compression (PostToolUse)

Automatically compresses test output from npm/jest/vitest runs:

```bash
# Runs automatically on Bash tool results
# Or manually:
echo '{"tool":"Bash","result":{"stdout":"..."}}' | python compress-test-output.py
```

### Atlas Caching (PreToolUse)

Caches processed atlas context:

```bash
# Build cache
python atlas-cache.py build --repo-path /path/to/repo

# Get cached context
python atlas-cache.py get --repo-path /path/to/repo

# Invalidate cache
python atlas-cache.py invalidate --repo-path /path/to/repo

# View stats
python atlas-cache.py stats
```

### Context Compaction

Compacts large Bash/Task tool outputs into structured summaries for long-running workflows:

```bash
# Runs automatically as PostToolUse hook on large outputs
# Or check stats:
python context-compaction.py --status
```

The threshold is configurable via `token_optimization.warn_threshold_tokens` in `.claude/project.config.json`.

### Session Stop (Stop)

Runs at session end to capture summary and handoff metadata:

```bash
# Runs automatically as Stop hook
# Or check status:
python session-stop.py --status
```

Features:
- Generates session summary (compactions performed, tokens saved, cache hits)
- Captures handoff metadata to `.claude/artifacts/handoffs/` if the directory exists
- Persists session stats to state dir for cross-session tracking

### Session Token Analysis

Parses Claude Code JSONL session transcripts and produces per-agent token breakdowns with cost estimation:

```bash
# Analyze a specific session file
python3 analyze-session-tokens.py ~/.claude/projects/<project>/<session-id>.jsonl

# Auto-discover and analyze the latest session
python3 analyze-session-tokens.py --latest

# Analyze a full session directory (main + all subagents)
python3 analyze-session-tokens.py --session-dir ~/.claude/projects/<project>/<session-id>

# Output as JSON for programmatic use
python3 analyze-session-tokens.py --latest --json

# Custom pricing (e.g. Sonnet pricing instead of Opus)
python3 analyze-session-tokens.py --latest --input-price 3 --output-price 15
```

Output includes:
- Total token counts (input, output, cache write, cache read)
- Per-agent breakdown with agent ID and slug
- Cache hit rate for prompt caching effectiveness
- Cost estimation at configurable per-M-token pricing (default: Opus at $15/$75)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CLAUDE_ATLAS_CACHE_BUCKET` | S3 bucket for distributed caching | (none) |

## How It Works

### Context Loader (UserPromptSubmit)

1. Receives every user prompt submission via the UserPromptSubmit hook
2. Scans for `/skill-name` patterns to detect skill invocations
3. Maps the skill name to a context mode (dev, research, review)
4. Loads the corresponding context file from `.claude/contexts/`
5. Injects mode-specific behavioral rules as a message to the agent

### Test Output Compression

1. Detects test runner output (jest, vitest, mocha, etc.)
2. Preserves: failures, errors, summary, stack traces
3. Omits: repetitive "passed" lines
4. Inserts: omission notice with count

### Atlas Caching

1. Hashes atlas files to detect changes
2. Caches processed summaries locally and optionally in S3
3. Reduces full atlas load from ~50K to ~10K tokens
4. Auto-invalidates when atlas files change

### Context Compaction

1. Detects large outputs from Bash/Task tools (above configured token threshold)
2. Extracts important lines (errors, warnings, status signals, test results)
3. Preserves head/tail of output for context
4. Generates structured summary: Task Overview, Current State, Important Discoveries, Next Steps, Context to Preserve
5. Tracks compaction stats persistently across sessions

### Session Stop (Stop)

1. Reads persisted compaction stats and cache stats from the state directory
2. Generates a session summary with timestamp, token savings, and cache hit rates
3. Writes handoff metadata to `.claude/artifacts/handoffs/` if the directory exists
4. Appends session stats to `session_history.json` for cross-session tracking

### Session Token Analysis

1. Parses JSONL session files line by line
2. Extracts `usage` fields from assistant messages (input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens)
3. Groups by `agentId` field to separate main session from subagents
4. Calculates costs using configurable per-M-token pricing
5. Computes cache hit rates for prompt caching effectiveness tracking

## Metrics

View optimization stats:

```bash
# Atlas cache stats
python atlas-cache.py stats

# Context compaction stats
python context-compaction.py --status

# Session stop hook stats
python session-stop.py --status

# Session token analysis
python analyze-session-tokens.py --latest

# Overall status (includes session analysis summary)
python status.py
```

## Troubleshooting

### Hooks not running

Check that the hooks are correctly registered in `settings.json` and that `uv` is available.

### Cache not working

Ensure the configured temp directory (default: system temp + project prefix) is writable.

### S3 caching failing

Set `CLAUDE_ATLAS_CACHE_BUCKET` environment variable and ensure AWS credentials are configured.
