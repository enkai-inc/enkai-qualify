---
name: observatory
description: "Monitor open-source repos for improvements. Proposes adaptations to pedro config."
argument-hint: "[scan|analyze <repo>|report|add <repo-url>]"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, WebSearch, WebFetch, Task
---

# Observatory: $ARGUMENTS

You are the Observatory agent. You monitor open-source Claude Code projects for improvements and propose adaptations to pedro's configuration — the base config layer for all Frank containers, optimized for enkai's workflows.

**Configuration**: Watchlist at `.claude/observatory/watchlist.json`, state at `.claude/observatory/state.json`.

## Parse Mode

Parse $ARGUMENTS for the mode. Default to `scan` if no argument given.

| Mode | Purpose |
|------|---------|
| `scan` | Poll all watched repos for changes, download changed config files, report summary |
| `analyze <owner/repo>` | Deep-dive a single repo — download all config files, compare against ours |
| `publish` | Create GitHub issues from high-priority proposals and batch weekly digests |
| `report` | Summary of scan history, pending proposals, stats |
| `add <repo-url>` | Add a repo to the watchlist |

---

## Mode: scan

### Step 1: Load Configuration

```bash
# Read watchlist and state
WATCHLIST=$(cat .claude/observatory/watchlist.json)
STATE=$(cat .claude/observatory/state.json)
SCAN_START=$(date -u +%Y-%m-%dT%H:%M:%SZ)
```

Track counters for the scan summary:
- `repos_checked` = 0
- `repos_changed` = 0
- `files_downloaded` = 0
- `errors` = 0

### Step 2: Poll Each Repo

For each repo in the watchlist, check if it has changed since the last scan.

**For each repo** (iterate via `jq`):

#### 2a. Get current HEAD SHA

```bash
REPO="owner/name"
BRANCH="main"  # from watchlist
CURRENT_SHA=$(gh api "/repos/${REPO}/commits/${BRANCH}" --jq '.sha' 2>/dev/null)
```

If the API call fails (repo deleted, private, rate limited), log the error and skip:
```bash
if [ -z "$CURRENT_SHA" ]; then
  echo "ERROR: Failed to fetch HEAD for ${REPO} — skipping"
  # Increment errors counter
  continue
fi
```

Increment `repos_checked`.

#### 2b. Compare against last-known SHA

```bash
LAST_SHA=$(echo "$STATE" | jq -r ".repos[\"${REPO}\"].last_sha // \"\"")
```

If `CURRENT_SHA == LAST_SHA`, the repo hasn't changed — skip to next repo.

If `LAST_SHA` is empty (first scan for this repo), treat as changed.

#### 2c. Fetch changed files

When the repo has changed, get the list of commits since last scan that touch our watched paths:

```bash
LAST_SCANNED=$(echo "$STATE" | jq -r ".repos[\"${REPO}\"].last_scanned // \"\"")

# Get commits since last scan (or last 7 days if first scan)
if [ -z "$LAST_SCANNED" ]; then
  SINCE=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-7d +%Y-%m-%dT%H:%M:%SZ)
else
  SINCE="$LAST_SCANNED"
fi

# Fetch recent commits — limit to 10 to stay within API budget
COMMITS=$(gh api "/repos/${REPO}/commits?sha=${BRANCH}&since=${SINCE}&per_page=10" \
  --jq '.[].sha' 2>/dev/null)
```

#### 2d. Identify changed files matching patterns

For each commit, get the list of changed files and filter by the repo's watched patterns:

```bash
# Get changed files from the comparison between last SHA and current HEAD
if [ -n "$LAST_SHA" ]; then
  CHANGED_FILES=$(gh api "/repos/${REPO}/compare/${LAST_SHA}...${CURRENT_SHA}" \
    --jq '.files[].filename' 2>/dev/null)
else
  # First scan: get the tree listing instead
  CHANGED_FILES=$(gh api "/repos/${REPO}/git/trees/${CURRENT_SHA}?recursive=1" \
    --jq '.tree[] | select(.type == "blob") | .path' 2>/dev/null)
fi
```

Filter `CHANGED_FILES` against the repo's patterns from the watchlist. The patterns use glob syntax (`.claude/**`, `hooks/**`, `CLAUDE.md`, etc.). Match files that fit any of the repo's patterns.

Limit to `max_files_per_repo` from scan_config (default 10).

#### 2e. Download matching files

For each matched file, download its content:

```bash
DOWNLOAD_DIR="/tmp/observatory/${REPO//\//_}"
mkdir -p "$DOWNLOAD_DIR"

for FILE in $MATCHED_FILES; do
  # Download via Contents API (base64 encoded, up to 384KB)
  CONTENT=$(gh api "/repos/${REPO}/contents/${FILE}?ref=${BRANCH}" \
    --jq '.content' 2>/dev/null | base64 -d)

  if [ -n "$CONTENT" ]; then
    # Preserve directory structure
    mkdir -p "$DOWNLOAD_DIR/$(dirname "$FILE")"
    echo "$CONTENT" > "$DOWNLOAD_DIR/$FILE"
    # Increment files_downloaded
  fi
done
```

Increment `repos_changed`.

### Step 3: Analyze Changes

For each repo that had changes downloaded, launch an analyzer subagent to score relevance and generate proposals.

**Launch one subagent per changed repo** (use Task tool with subagent_type="general-purpose", model="haiku" for initial triage):

#### Analyzer Subagent Prompt

For each changed repo, pass the subagent this prompt (fill in the variables):

```
You are the Observatory Analyzer. Compare the following file(s) from an external
open-source repo against our configuration and score their relevance.

## Source
- Repo: {REPO} ({CATEGORY})
- Priority: {PRIORITY}
- Notes: {NOTES}

## Their File(s)
{For each downloaded file, include its path and full content}

## Our Equivalent File(s)
{For each of their files, include our equivalent from .claude/ if it exists,
or note "We don't have an equivalent for this."}

## Our Workflow Context
Pedro's .claude/ is the base config for all Frank ECS containers. The primary
consumer is enkai, an AI Feature Builder with these core workflows:
- /design: 6-phase structured research with quality gates
- /scrum: Parallel issue processing with 2 workers in git worktrees
- /build: Scaffolder → implementer → reviewer → CI → PR pipeline
- /deploy: CDK infrastructure deployment, Docker builds, ECS updates
- /observatory: This skill — monitoring open-source for improvements

Key areas of interest:
- Token optimization (hooks, caching, context management)
- Skill patterns (structure, quality gates, parallel execution)
- CLAUDE.md patterns (behavioral rules, constraints, skill selection)
- Hook patterns (PreToolUse/PostToolUse for validation, automation)
- MCP configurations (new servers, tool patterns)
- Agent orchestration (multi-agent, subagent strategies)

## Instructions
For EACH file, produce a JSON object with these fields:

{
  "file": "path/to/their/file",
  "category": "skill|hook|token-optimization|claude-md|mcp|agent|other",
  "score": 0-10,
  "justification": "Why this score — be specific about what's valuable or not",
  "dominated": true/false,
  "dominated_by": "path/to/our/file (if our version is clearly better)",
  "proposal": {
    "summary": "1-2 sentence description of the proposed change",
    "our_file": "path to file we'd modify (or 'NEW: path' for new files)",
    "change_type": "adopt|adapt|merge|skip",
    "specific_changes": "Concrete description of what to add/modify/replace",
    "impact": {
      "tokens": "estimate if applicable (e.g., '-15% on skill load')",
      "quality": "description of quality improvement",
      "workflow": "description of workflow improvement"
    }
  }
}

Scoring guide:
- 9-10: Must adopt — clearly better than what we have, directly improves enkai's workflows
- 7-8: Should adopt — valuable pattern we're missing, specific improvement with clear benefit
- 5-6: Worth considering — interesting approach, but our version may be sufficient
- 3-4: Low value — minor improvement, not worth the churn
- 0-2: Not relevant — different context, already have better, or not applicable

Be aggressive with low scores. Most changes in most repos will NOT be relevant.
Only score 7+ when the improvement is specific, actionable, and clearly beneficial.

Return a JSON array of objects, one per file analyzed.
```

#### Process Analyzer Results

Parse the JSON output from each subagent:

- **Score >= 7**: Add to `high_priority_proposals` list — these become individual GitHub issues (in Part 4)
- **Score 4-6**: Add to `digest_buffer` in state.json — these get batched into weekly digests
- **Score < 4**: Log to scan summary as "skipped" with the justification

Update findings count in state per repo.

```bash
# Add digest items to state
STATE=$(echo "$STATE" | jq --argjson items "$DIGEST_ITEMS" \
  '.digest_buffer = (.digest_buffer + $items)')
```

### Step 4: Update State

After processing all repos, update `state.json`:

```bash
# Update per-repo state
STATE=$(echo "$STATE" | jq --arg repo "$REPO" \
  --arg sha "$CURRENT_SHA" \
  --arg ts "$SCAN_START" \
  '.repos[$repo] = {
    "last_sha": $sha,
    "last_scanned": $ts,
    "findings_count": (.repos[$repo].findings_count // 0)
  }')

# Update scan history (keep last 50 entries)
STATE=$(echo "$STATE" | jq --arg ts "$SCAN_START" \
  --argjson checked "$REPOS_CHECKED" \
  --argjson changed "$REPOS_CHANGED" \
  --argjson files "$FILES_DOWNLOADED" \
  --argjson errors "$ERRORS" \
  '.scan_history = ([{
    "timestamp": $ts,
    "repos_checked": $checked,
    "changes_detected": $changed,
    "files_downloaded": $files,
    "errors": $errors
  }] + .scan_history) | .scan_history = .scan_history[:50]
  | .last_scan = $ts
  | .total_scans = (.total_scans + 1)')

# Write state back
echo "$STATE" | jq '.' > .claude/observatory/state.json
```

### Step 5: Report Summary

Print a structured summary of the scan:

```
## Observatory Scan Complete

**Scanned:** REPOS_CHECKED repos
**Changed:** REPOS_CHANGED repos since last scan
**Files downloaded:** FILES_DOWNLOADED
**Files analyzed:** FILES_ANALYZED
**Errors:** ERRORS
**Scan time:** SCAN_START

### High-Priority Findings (score >= 7)

| Repo | File | Category | Score | Summary |
|------|------|----------|-------|---------|
| owner/name | path/to/file | skill | 8 | Brief proposal summary |
| ... | ... | ... | ... | ... |

(Run `/observatory publish` to create GitHub issues from these)

### Digest Items (score 4-6)

N items added to weekly digest buffer (DIGEST_BUFFER_TOTAL total pending).

### Skipped (score < 4)

| Repo | File | Score | Reason |
|------|------|-------|--------|
| ... | ... | 2 | Not relevant because... |

### Errors (if any)

- repo: error message

### Next Steps

- Run `/observatory publish` to create GitHub issues from high-priority findings
- Run `/observatory analyze owner/repo` to deep-dive a specific repo
- Run `/observatory publish digest` to flush the digest buffer into a weekly summary issue
```

---

## Mode: analyze <owner/repo>

Deep-dive a single repo. Downloads all config files (not just changed ones) and compares against our `.claude/` configuration.

### Step 1: Validate Repo

Check the repo exists and is in our watchlist (or accept any public repo).

### Step 2: Download All Config Files

Download all files matching common Claude config patterns:
- `.claude/**`
- `CLAUDE.md`, `claude.md`
- `**/SKILL.md`
- `hooks/**`, `.claude/hooks/**`
- `AGENTS.md`, `.claude/agents/**`
- `.mcp*`, `mcp.json`

Use the git tree API to list all files, filter by patterns, then download via Contents API.

### Step 3: Analyze Each File with Subagent

For each downloaded file, find our equivalent and run the analyzer subagent:
- Their `.claude/skills/X/SKILL.md` → our `.claude/skills/X/SKILL.md` (or note we don't have it)
- Their `CLAUDE.md` → our `.claude/CLAUDE.md`
- Their hooks → our `.claude/hooks/`

**Launch one subagent per file group** (use Task tool with subagent_type="general-purpose", model="haiku"):

Use the same Analyzer Subagent Prompt from scan mode (see above). Pass ALL downloaded files from this repo and ALL our equivalent files for comprehensive comparison.

Collect all scored results into a single list for the report.

### Step 4: Generate Analysis Report

```
## Observatory Analysis: owner/repo

### Overview
- Repo: URL
- Category: X
- Last commit: SHA (date)
- Config files found: N
- Files analyzed: N

### Scored Results

| Their File | Category | Score | Change Type | Summary |
|-----------|----------|-------|-------------|---------|
| path/file | skill | 9 | adopt | Brief proposal summary |
| path/file | hook | 5 | adapt | Brief proposal summary |
| ... | ... | ... | ... | ... |

### High-Priority Proposals (score >= 7)

For each high-scoring file, include full details:

#### [Their File Path] — Score: N/10
- **Category:** skill|hook|token-optimization|claude-md|mcp|agent
- **Our equivalent:** path/to/our/file (or "none")
- **Change type:** adopt|adapt|merge
- **Justification:** Why this score
- **Proposed changes:** Concrete description of what to add/modify/replace
- **Impact:**
  - Tokens: estimate if applicable
  - Quality: description
  - Workflow: description

### Worth Considering (score 4-6)

Brief summary of medium-scoring items for future reference.

### Not Relevant (score < 4)

| Their File | Score | Reason |
|-----------|-------|--------|
| ... | 2 | Already have better version at ... |

### Recommendations
1. [Top recommendation — most impactful change to make]
2. [Second recommendation]
3. [Third recommendation]

### Next Steps
- Run `/observatory publish` to create GitHub issues from high-priority proposals
- Run `/observatory scan` to check for new changes across all repos
```

---

## Mode: publish

Create GitHub issues from analyzer proposals. Supports two sub-modes:
- `publish` (default) — publish high-priority proposals (score >= 7) as individual issues
- `publish digest` — batch all digest buffer items (score 4-6) into a single weekly summary issue

### Step 1: Load State & Ensure Labels

```bash
STATE=$(cat .claude/observatory/state.json)
PUBLISH_START=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Create observatory label on first run (idempotent)
gh label create "observatory" --description "Proposed by Observatory — external repo improvement" --color "0e8a16" 2>/dev/null || true
gh label create "enhancement" --color "a2eeef" 2>/dev/null || true
```

### Step 2: Determine Sub-Mode

Parse $ARGUMENTS:
- If `publish digest` → go to Step 5 (Weekly Digest)
- If `publish` (no qualifier) → continue to Step 3 (Individual Issues)

### Step 3: Publish High-Priority Proposals

Read high-priority proposals from state. These are populated by the scan mode's analyzer (score >= 7).

```bash
HIGH_PRIORITY=$(echo "$STATE" | jq '.high_priority_proposals // []')
COUNT=$(echo "$HIGH_PRIORITY" | jq 'length')
```

If `COUNT == 0`, report "No high-priority proposals to publish" and exit.

**For each proposal**, check if already published (deduplicate by source repo + file path):

```bash
ALREADY_PUBLISHED=$(echo "$STATE" | jq -r '.published_proposals // [] | .[].source_key')
SOURCE_KEY="${REPO}:${FILE_PATH}:${COMMIT_SHA}"

# Skip if already published
if echo "$ALREADY_PUBLISHED" | grep -qF "$SOURCE_KEY"; then
  echo "Already published: $SOURCE_KEY — skipping"
  continue
fi
```

#### 3a. Search EnkaiRelay for Existing Discussion

Before creating an issue, check EnkaiRelay for community context on this topic:

```bash
# Load EnkaiRelay credentials
ENKAI_RELAY_API_KEY=$(cat ~/.config/enkai-relay/credentials.json | jq -r '.api_key')
ENKAI_RELAY_API_URL="https://enkai-relay.digitaldevops.io"

# Semantic search for related discussions
SEARCH_QUERY="${CATEGORY} ${PROPOSAL_SUMMARY}"
ENKAI_RELAY_RESULTS=$(curl -s "${ENKAI_RELAY_API_URL}/api/v1/search/semantic?q=$(echo "$SEARCH_QUERY" | jq -sRr @uri)" \
  -H "x-api-key: ${ENKAI_RELAY_API_KEY}")
```

Parse results — if relevant posts found (check titles/context for topic overlap), collect their IDs and titles for cross-reference. Include up to 3 most relevant EnkaiRelay posts in the issue body.

If no EnkaiRelay results found, set `ENKAI_RELAY_SECTION` to empty string.

Build the cross-reference section:

```
## Community Context (EnkaiRelay)

Related discussions found on EnkaiRelay:
- [Post Title](https://enkai-relay.digitaldevops.io/posts/POST_ID) — brief context
- [Post Title](https://enkai-relay.digitaldevops.io/posts/POST_ID) — brief context

Consider these discussions when evaluating this proposal.
```

If no results: omit this section entirely.

#### 3b. Create Issue with EnkaiRelay Cross-References

Create one issue per high-priority proposal:

```bash
gh issue create \
  --label "enhancement" \
  --label "observatory" \
  --title "[Observatory] ${PROPOSAL_SUMMARY}" \
  --body "$(cat <<'ISSUE_EOF'
## Observatory Proposal

**Source:** [${REPO}](https://github.com/${REPO}) @ `${COMMIT_SHA_SHORT}`
**File:** [`${THEIR_FILE}`](https://github.com/${REPO}/blob/${BRANCH}/${THEIR_FILE})
**Category:** ${CATEGORY}
**Score:** ${SCORE}/10
**Change Type:** ${CHANGE_TYPE}

## What Changed

${JUSTIFICATION}

## Proposed Adaptation

${SPECIFIC_CHANGES}

### Files to Modify

| Our File | Change |
|----------|--------|
| `${OUR_FILE}` | ${CHANGE_DESCRIPTION} |

## Impact Assessment

| Dimension | Expected Impact |
|-----------|----------------|
| **Tokens** | ${IMPACT_TOKENS} |
| **Quality** | ${IMPACT_QUALITY} |
| **Workflow** | ${IMPACT_WORKFLOW} |

${ENKAI_RELAY_SECTION}

## Source Context

- **Repo category:** ${CATEGORY}
- **Repo priority:** ${PRIORITY}
- **Repo notes:** ${NOTES}

---
*Generated by `/observatory publish` — review before applying.*
*To adopt: create a branch, make the changes, and PR.*
ISSUE_EOF
)"
```

#### 3c. Share to EnkaiRelay (score >= 8 only)

For proposals scoring 8 or higher, share to the EnkaiRelay #patterns channel to benefit the community:

```bash
if [ "$SCORE" -ge 8 ]; then
  # Find the #patterns channel ID
  CHANNELS=$(curl -s "${ENKAI_RELAY_API_URL}/api/v1/channels" \
    -H "x-api-key: ${ENKAI_RELAY_API_KEY}")
  PATTERNS_CHANNEL=$(echo "$CHANNELS" | jq -r '.data[] | select(.name == "patterns") | .id')

  # Share the finding
  curl -s -X POST "${ENKAI_RELAY_API_URL}/api/v1/posts" \
    -H "x-api-key: ${ENKAI_RELAY_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"title\": \"Observatory finding: ${PROPOSAL_SUMMARY}\",
      \"body\": \"Found in [${REPO}](https://github.com/${REPO}) — ${JUSTIFICATION}\n\n**What changed:** \`${THEIR_FILE}\`\n**Score:** ${SCORE}/10\n**Category:** ${CATEGORY}\n\n**Proposed adaptation:**\n${SPECIFIC_CHANGES}\n\n**Impact:** ${IMPACT_QUALITY}\n\n---\n*Shared by pedro's /observatory — monitoring open-source Claude Code repos for improvements.*\",
      \"channelId\": \"${PATTERNS_CHANNEL}\"
    }"

  # Track that we shared this
  echo "Shared to EnkaiRelay #patterns"
fi
```

Follow EnkaiRelay style guide: specific title, cite the source repo, include what changed and why it matters, note trade-offs.

After successful creation, record in state to prevent duplicates:

```bash
STATE=$(echo "$STATE" | jq --arg key "$SOURCE_KEY" \
  --arg issue "$ISSUE_NUMBER" \
  --arg ts "$PUBLISH_START" \
  '.published_proposals = (.published_proposals // []) + [{
    "source_key": $key,
    "issue_number": ($issue | tonumber),
    "published_at": $ts
  }]
  | .total_proposals = (.total_proposals + 1)')
```

Track counters: `issues_created`, `issues_skipped` (already published).

### Step 4: Update State & Report (Individual Issues)

```bash
echo "$STATE" | jq '.' > .claude/observatory/state.json
```

Print summary:

```
## Observatory Publish Complete

**Published:** ISSUES_CREATED new issues
**Skipped:** ISSUES_SKIPPED (already published)
**EnkaiRelay cross-refs found:** ENKAI_RELAY_REFS_COUNT
**Shared to EnkaiRelay:** ENKAI_RELAY_SHARED_COUNT (score >= 8)

### Issues Created

| # | Title | Score | Source Repo | EnkaiRelay Refs | Shared |
|---|-------|-------|-------------|-----------|--------|
| #N | [Observatory] Summary | 8 | owner/repo | 2 | Yes |
| ... | ... | ... | ... | ... | ... |

### Next Steps
- Review and prioritize the new issues
- Run `/eval` to start implementing high-value proposals
- Check EnkaiRelay #patterns for community feedback on shared findings
```

Then clear `high_priority_proposals` from state (they've been published):

```bash
STATE=$(echo "$STATE" | jq '.high_priority_proposals = []')
echo "$STATE" | jq '.' > .claude/observatory/state.json
```

### Step 5: Weekly Digest (publish digest)

Batch all digest buffer items into a single summary issue.

```bash
DIGEST=$(echo "$STATE" | jq '.digest_buffer // []')
DIGEST_COUNT=$(echo "$DIGEST" | jq 'length')
```

If `DIGEST_COUNT == 0`, report "Digest buffer is empty — nothing to publish" and exit.

#### Digest Issue Template

Create one issue summarizing all medium-priority items:

```bash
WEEK_OF=$(date -u +%Y-%m-%d)

gh issue create \
  --label "enhancement" \
  --label "observatory" \
  --title "[Observatory Digest] Week of ${WEEK_OF} — ${DIGEST_COUNT} items" \
  --body "$(cat <<'DIGEST_EOF'
## Observatory Weekly Digest

**Period:** Since last digest
**Items:** ${DIGEST_COUNT}
**Score range:** 4-6 (worth considering, not urgent)

## Items

${FOR_EACH_ITEM}
### ${INDEX}. ${SUMMARY} (score ${SCORE})

- **Source:** [${REPO}](https://github.com/${REPO}) → `${THEIR_FILE}`
- **Category:** ${CATEGORY}
- **Change type:** ${CHANGE_TYPE}
- **Justification:** ${JUSTIFICATION}
- **Our file:** `${OUR_FILE}`
- **Proposed change:** ${SPECIFIC_CHANGES}

${END_FOR_EACH}

## Triage Guide

Review each item above and decide:
- **Promote to issue** — if on second look this is actually high-value, create a standalone issue
- **Skip** — not worth the churn right now
- **Defer** — interesting but not a priority this cycle

---
*Generated by `/observatory publish digest`*
*${DIGEST_COUNT} items cleared from digest buffer.*
DIGEST_EOF
)"
```

After successful creation, clear the digest buffer:

```bash
STATE=$(echo "$STATE" | jq \
  --arg ts "$PUBLISH_START" \
  --arg issue "$ISSUE_NUMBER" \
  '.digest_buffer = []
  | .last_digest = $ts
  | .digest_history = (.digest_history // []) + [{
    "published_at": $ts,
    "issue_number": ($issue | tonumber),
    "item_count": (.digest_buffer | length)
  }]')
echo "$STATE" | jq '.' > .claude/observatory/state.json
```

Print summary:

```
## Observatory Digest Published

**Issue:** #ISSUE_NUMBER
**Items included:** DIGEST_COUNT
**Digest buffer:** cleared

### Next Steps
- Review the digest issue and triage items
- Run `/observatory scan` for fresh data
```

---

## Mode: report

Summarize scan history and observatory status.

### Step 1: Load State

Read `.claude/observatory/state.json`.

### Step 2: Generate Report

```
## Observatory Report

### Status
- Total scans: N
- Last scan: TIMESTAMP
- Repos monitored: N
- Total proposals published: N
- Pending high-priority proposals: N
- Pending digest items: N
- Last digest: TIMESTAMP (or "never")

### Recent Scans
| Date | Repos Checked | Changes | Files | Errors |
|------|--------------|---------|-------|--------|
| ... | ... | ... | ... | ... |

### Per-Repo Status
| Repo | Category | Priority | Last SHA | Last Scanned | Findings |
|------|----------|----------|----------|-------------|----------|
| ... | ... | ... | ... | ... | N |

### Published Proposals
| # | Title | Source Repo | Published |
|---|-------|-------------|-----------|
| #N | [Observatory] ... | owner/repo | 2026-01-15 |

### Digest History
| # | Week | Items | Published |
|---|------|-------|-----------|
| #N | 2026-01-13 | 5 | 2026-01-15 |

### Pending Items
- High-priority proposals awaiting publish: N
- Digest buffer items awaiting next digest: N

### Next Steps
- Run `/observatory scan` for fresh data
- Run `/observatory publish` to create issues from high-priority proposals
- Run `/observatory publish digest` to flush digest buffer
```

---

## Mode: add <repo-url>

Add a new repo to the watchlist.

### Step 1: Parse URL

Extract owner and name from the URL (supports `https://github.com/owner/name` and `owner/name` formats).

### Step 2: Validate Repo Exists

```bash
gh api "/repos/${OWNER}/${NAME}" --jq '.full_name' 2>/dev/null
```

### Step 3: Detect Config Patterns

Scan the repo for Claude config files to auto-detect patterns:

```bash
TREE=$(gh api "/repos/${OWNER}/${NAME}/git/trees/HEAD?recursive=1" \
  --jq '.tree[] | select(.type == "blob") | .path' 2>/dev/null)
```

Check for `.claude/`, `CLAUDE.md`, `skills/`, `hooks/`, `AGENTS.md`, `.mcp*`.

### Step 4: Add to Watchlist

Append the new repo to `watchlist.json` with detected patterns:

```bash
jq --arg owner "$OWNER" --arg name "$NAME" --arg branch "main" \
  --argjson patterns "$DETECTED_PATTERNS" \
  '.repos += [{"owner": $owner, "name": $name, "branch": $branch, "patterns": $patterns, "category": "community", "priority": "medium", "notes": "Added via /observatory add"}]' \
  .claude/observatory/watchlist.json > /tmp/watchlist.tmp && mv /tmp/watchlist.tmp .claude/observatory/watchlist.json
```

Report what was added and what patterns were detected.

---

## API Budget

| Operation | Calls/Repo | Notes |
|-----------|-----------|-------|
| HEAD SHA check | 1 | Always |
| Compare commits | 1 | Only if changed |
| Download files | 1-10 | Only changed files matching patterns |
| **Max per scan** | **~40 total** | For 10 repos, ~4 calls each average |
| **Rate limit** | **5000/hour** | We use <1% |

## Error Handling

- **Repo not found (404):** Log warning, skip repo, continue scan
- **Rate limited (429):** Stop scan immediately, report partial results, note in state
- **Empty response:** Treat as no changes, update SHA anyway
- **Large files (>384KB):** Skip file, note in summary
- **Network timeout:** Retry once, then skip repo

## Important Guidelines

- **Never modify watchlist during scan** — only the `add` mode modifies watchlist.json
- **Always update state** — even on partial scans, update what was successfully checked
- **Respect API budget** — if approaching 50 calls in a single scan, stop and report partial results
- **Downloaded files are ephemeral** — `/tmp/observatory/` is not persistent; analysis must happen in the same session
- **Proposals are scored, not auto-applied** — analyzer generates proposals with scores; human reviews before adoption

## Recommended Schedule

| Frequency | Command | Purpose |
|-----------|---------|---------|
| Daily (heartbeat) | `/observatory scan` | Poll repos, analyze changes, report findings |
| Weekly | `/observatory publish digest` | Batch medium-priority items into digest issue |
| After scan with findings | `/observatory publish` | Create issues from high-priority proposals |
| On demand | `/observatory analyze owner/repo` | Deep-dive a specific repo |
| On demand | `/observatory add <url>` | Add a new repo to the watchlist |
| On demand | `/observatory report` | Check scan history and pending items |

### Improvement Pipeline

Observatory findings flow into the existing skill pipeline:

```
/observatory scan → /observatory publish → /design → /plan → /execute
```

1. **Scan** detects changes and scores relevance
2. **Publish** creates GitHub issues from high-scoring proposals
3. **Design** deep-dives the proposal through 6-dimension research
4. **Plan** evaluates adoption complexity
5. **Execute** implements the approved adaptation
