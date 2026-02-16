#!/bin/bash
# SessionStart hook: Fix CLAUDE_PROJECT_DIR for worktree environments.
#
# Claude Code has known issues resolving CLAUDE_PROJECT_DIR in git worktrees
# (GH issues #9447, #12885, #16089). This hook ensures the variable is set
# correctly by writing it to CLAUDE_ENV_FILE, which persists across all
# subsequent tool calls in the session.

set -euo pipefail

# Read hook input from stdin
INPUT=$(cat)

# Get the env file path from input (only available in SessionStart)
if ! ENV_FILE=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('env_file',''))" 2>/dev/null); then
    echo "fix-worktree-env: failed to parse env_file from hook input" >&2
    echo '{"decision":"allow"}'
    exit 0
fi

if [ -z "$ENV_FILE" ]; then
    # No env file available — output JSON and exit
    echo '{"decision":"allow"}'
    exit 0
fi

# Determine correct project directory
# Priority: 1) git toplevel, 2) CWD from hook input, 3) existing CLAUDE_PROJECT_DIR
PROJECT_DIR=""
if ! CWD=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('cwd',''))" 2>/dev/null); then
    echo "fix-worktree-env: failed to parse cwd from hook input" >&2
    echo '{"decision":"allow"}'
    exit 0
fi

if [ -n "$CWD" ] && [ -d "$CWD" ]; then
    if git -C "$CWD" rev-parse --git-dir >/dev/null 2>&1; then
        PROJECT_DIR=$(git -C "$CWD" rev-parse --show-toplevel 2>/dev/null || echo "$CWD")
    else
        echo "fix-worktree-env: $CWD is not inside a git repository" >&2
        PROJECT_DIR="$CWD"
    fi
elif [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
    PROJECT_DIR="$CLAUDE_PROJECT_DIR"
fi

# Write to env file so it persists for all hooks in this session
if [ -n "$PROJECT_DIR" ] && [ -n "$ENV_FILE" ]; then
    echo "CLAUDE_PROJECT_DIR=$PROJECT_DIR" >> "$ENV_FILE"
fi

echo '{"decision":"allow"}'
