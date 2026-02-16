---
name: design
description: "Double Diamond design process with 9 specialized agents, gate validation, and artifact persistence."
argument-hint: "[feature topic] [--mode full|lightweight|discover-only]"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, WebSearch, WebFetch, Task
---

# /design - Double Diamond Design Process

Orchestrate a comprehensive design process through four phases: **DISCOVER → DEFINE → DEVELOP → DELIVER**. Uses 9 specialized design agents, produces 30+ artifacts, and enforces gate validation between phases.

**Configuration**: Read `.claude/project.config.json` for repo_owner, repo_name, labels, and paths.

## When to Use This Skill

- "Design [feature]"
- "Run /design [topic]"
- Major features requiring full design process
- When you need comprehensive stakeholder alignment before building

## Depth Modes

Parse the arguments for a `--mode` flag. Default to `full` if not specified.

| Mode | Phases | Artifacts | Use Case |
|------|--------|-----------|----------|
| `full` | Discover → Define → Develop → Deliver | 30+ | Major features, complex initiatives |
| `lightweight` | Discover → Define | 17 | Smaller features, well-understood domains |
| `discover-only` | Discover | 8 | Research spikes, feasibility checks |

## Workflow Overview

```
0. Initialize
   └── Create docs/design/${FEATURE_ID}/, status.yml, tracking issue

1. DISCOVER (Divergent)
   ├── 4 agents in parallel
   ├── 8 artifacts
   └── Gate validation

2. DEFINE (Convergent)
   ├── PM → Designer+TL parallel → Stakeholder
   ├── 9 artifacts
   └── Gate validation

3. DEVELOP (Divergent)
   ├── 4 agents parallel → Engineer
   ├── 8 artifacts
   └── Gate validation

4. DELIVER (Convergent)
   ├── Engineer → QA+Marketer+Content parallel → PM sign-off
   ├── 5 artifacts
   └── Gate validation

5. Publish
   └── Update issue, create sub-issues, commit docs
```

## Phase 0: Initialize

### Parse Arguments

Extract feature topic and mode from $ARGUMENTS:

```
Topic: [everything except --mode flag]
Mode: full | lightweight | discover-only (default: full)
```

### Create Design Directory

```bash
# Get feature ID from next issue number
FEATURE_ID="GH-$(gh issue list --limit 1 --json number -q '.[0].number + 1' 2>/dev/null || echo "NEW")"

# Create directory structure
mkdir -p docs/design/${FEATURE_ID}/{discover,define,develop,deliver}
```

### Initialize Status File

Copy template from `.claude/skills/design/templates/status.yml` to `docs/design/${FEATURE_ID}/status.yml` and populate:
- `feature_id`
- `title`
- `created_at`
- `depth_mode`
- `last_activity`

### Create Tracking Issue

```bash
gh issue create \
  --title "[Design] ${TOPIC}" \
  --label "design" \
  --body "$(cat <<'EOF'
## Double Diamond Design: ${TOPIC}

### Status
- [ ] Discover phase
- [ ] Define phase
- [ ] Develop phase
- [ ] Deliver phase

### Artifacts Directory
\`docs/design/${FEATURE_ID}/\`

---
*Design in progress. This issue will be updated with findings and sub-issues.*
EOF
)"
```

Store the issue number as `TRACKING_ISSUE`.

### Initialize Templates

Copy from `.claude/skills/design/templates/`:
- `decision-log.md` → `docs/design/${FEATURE_ID}/`
- `open-questions.md` → `docs/design/${FEATURE_ID}/`

---

## Phase 1: DISCOVER (Divergent)

**Goal**: Understand the problem space and empathize with users.

### Launch Parallel Agents

Use the Task tool with `subagent_type="general-purpose"` to launch 4 agents in parallel:

```
1. design-product-manager (discover)
   → north-star.md, market-competitors.md, opportunity-backlog.md

2. design-ux-researcher (discover)
   → research-plan.md, interview-guide.md

3. design-product-designer (discover)
   → empathy-maps.md, ecosystem-map.md

4. design-tech-lead (discover)
   → feasibility-constraints.md
```

Each agent receives:
- `feature_id`: ${FEATURE_ID}
- `phase`: discover
- `design_dir`: docs/design/${FEATURE_ID}

### Wait for Completion

Monitor agent completion signals:
```
AGENT_COMPLETE: design-product-manager
AGENT_COMPLETE: design-ux-researcher
AGENT_COMPLETE: design-product-designer
AGENT_COMPLETE: design-tech-lead
```

### Gate Validation

Run gate validation per `.claude/skills/design/gates/discover-gate.md`:

1. Check all 8 required artifacts exist
2. Run 5 validation checks
3. Generate `docs/design/${FEATURE_ID}/discover/gate-result.json`

**Gate Status**:
- **COMPLETE**: All checks pass → proceed to DEFINE
- **INCOMPLETE**: 1-2 checks fail → proceed with awareness
- **BLOCKED**: 3+ checks fail → stop and escalate

### Update Status

Update `status.yml`:
- Set `discover` phase as completed
- Record gate status
- Set `current_phase` to "define" (or stop if discover-only mode)

---

## Phase 2: DEFINE (Convergent)

**Goal**: Narrow research into a clear, actionable brief.

*Skip if mode is `discover-only`.*

### Sequential with Parallel Groups

**Step 1: Product Manager**
```
design-product-manager (define)
→ problem-statement.md, prd.md, mvp-scope.md, success-metrics.md
```

**Step 2: Designer + Tech Lead (Parallel)**
```
design-product-designer (define)
→ user-journeys.md

design-tech-lead (define)
→ architecture-sketch.md, core-data-model.md
```

**Step 3: Stakeholder Review**
```
design-stakeholder (define)
→ stakeholder-review.md, updates decision-log.md
```

### Gate Validation

Run gate validation per `.claude/skills/design/gates/define-gate.md`:

1. Check all 9 required artifacts exist
2. Run 6 validation checks
3. Check for re-loop triggers
4. Generate `docs/design/${FEATURE_ID}/define/gate-result.json`

**Re-loop Triggers**:
- Conflicting ICP assumptions → DISCOVER
- No evidence path for problem → DISCOVER

### Update Status

Update `status.yml` and set `current_phase` to "develop" (or stop if lightweight mode).

---

## Phase 3: DEVELOP (Divergent)

**Goal**: Explore solutions and converge on buildable plan.

*Skip if mode is `lightweight` or `discover-only`.*

### Parallel then Sequential

**Step 1: Four Agents in Parallel**
```
design-product-designer (develop)
→ ia-sitemap.md, wireframes.md, ui-spec.md

design-tech-lead (develop)
→ tdd.md

design-ux-researcher (develop)
→ usability-test-plan.md

design-content-strategist (develop)
→ voice-and-tone.md, microcopy-inventory.md
```

**Step 2: Engineer Spikes**
```
design-engineer (develop)
→ Executes spikes for unknowns from feasibility-constraints.md
```

### Gate Validation

Run gate validation per `.claude/skills/design/gates/develop-gate.md`:

1. Check all 8 required artifacts exist
2. Run 5 validation checks
3. Check for pending spikes
4. Check for re-loop triggers
5. Generate `docs/design/${FEATURE_ID}/develop/gate-result.json`

**Re-loop Triggers**:
- Usability testing invalidates problem → DEFINE
- TDD requires MVP re-scope → DEFINE

### Update Status

Update `status.yml` and set `current_phase` to "deliver".

---

## Phase 4: DELIVER (Convergent)

**Goal**: Build, validate, and prepare for launch.

*Skip if mode is `lightweight` or `discover-only`.*

### Sequential with Parallel Groups

**Step 1: Engineer Implementation**
```
design-engineer (deliver)
→ Implementation based on TDD + UI spec
```

**Step 2: Three Agents in Parallel**
```
design-qa-engineer (deliver)
→ test-plan.md

design-product-marketer (deliver)
→ launch-plan.md, release-notes.md, sales-support-enablement.md

design-content-strategist (deliver)
→ Final content review
```

**Step 3: PM Sign-off**
```
design-product-manager (deliver)
→ Release readiness sign-off
```

### Gate Validation

Run gate validation per `.claude/skills/design/gates/deliver-gate.md`:

1. Check all 5 required artifacts exist
2. Run 6 validation checks
3. Check for re-loop triggers
4. Generate `docs/design/${FEATURE_ID}/deliver/gate-result.json`

**Re-loop Triggers**:
- Severe usability issues → DEVELOP
- Systemic QA failures → DEVELOP
- Requirements change → DEFINE

### Update Status

Update `status.yml` and set `current_phase` to "complete".

---

## Phase 5: Publish

### Update Tracking Issue

```bash
gh issue edit ${TRACKING_ISSUE} --body "$(cat <<'EOF'
## Double Diamond Design: ${TOPIC}

### Status
- [x] Discover phase (${DISCOVER_STATUS})
- [x] Define phase (${DEFINE_STATUS})
- [x] Develop phase (${DEVELOP_STATUS})
- [x] Deliver phase (${DELIVER_STATUS})

### Summary
[TLDR from artifacts]

### Key Decisions
[From decision-log.md]

### Artifacts
\`docs/design/${FEATURE_ID}/\`

### Sub-Issues
[Links to decomposed issues]
EOF
)"
```

### Create Sub-Issues (full mode only)

Based on PRD requirements, create implementable sub-issues:

```bash
gh issue create \
  --title "Part N: [Title]" \
  --label "enhancement" \
  --body "$(cat <<'EOF'
## Parent Design
Part of #${TRACKING_ISSUE} — ${TOPIC}

## Overview
[From PRD requirement]

## Acceptance Criteria
[From PRD]

## Technical Approach
[From TDD]

## Dependencies
- Depends on: [issues or "None"]

## Estimated Complexity
Low / Medium / High
EOF
)"
```

### Commit Artifacts

```bash
git add docs/design/${FEATURE_ID}/
git commit -m "docs(design): complete ${TOPIC} design

- 30+ artifacts across 4 Double Diamond phases
- Gate validation passed at all phases
- See #${TRACKING_ISSUE} for details

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Re-loop Handling

When a gate triggers a re-loop:

1. Update `status.yml` with re-loop record
2. Reset `current_phase` to the target phase
3. Re-run the target phase with additional context from the triggering phase
4. Continue forward from there

```yaml
# Example re-loop record
reloops:
  - from_phase: "define"
    to_phase: "discover"
    reason: "Conflicting ICP assumptions"
    timestamp: "2026-02-14T10:00:00Z"
```

---

## Agent Dispatch Pattern

When launching agents, use the Task tool:

```
Task(
  subagent_type="general-purpose",
  prompt="
You are the ${AGENT_NAME}. Read your agent definition at .claude/agents/${AGENT_FILE}.

Context:
- Feature ID: ${FEATURE_ID}
- Phase: ${PHASE}
- Design directory: docs/design/${FEATURE_ID}
- Prior artifacts: [list any relevant artifacts from previous phases]

Execute your ${PHASE} phase process and create the required artifacts.
Output AGENT_COMPLETE when done.
",
  run_in_background=true
)
```

---

## Human Checkpoints

At each phase transition, pause for human review:

1. Output phase summary
2. List key decisions
3. Highlight open questions
4. Wait for explicit "continue" before proceeding

For autonomous mode, skip checkpoints and proceed automatically.

---

## Output Summary

After completion, output:

```markdown
## Design Complete: ${TOPIC}

**Feature ID**: ${FEATURE_ID}
**Mode**: full | lightweight | discover-only
**Duration**: X hours

### Phase Results
| Phase | Status | Artifacts | Gate |
|-------|--------|-----------|------|
| Discover | ✅ | 8 | COMPLETE |
| Define | ✅ | 9 | COMPLETE |
| Develop | ✅ | 8 | COMPLETE |
| Deliver | ✅ | 5 | COMPLETE |

### Key Decisions
1. [Decision 1]
2. [Decision 2]
3. [Decision 3]

### Open Questions
- [Question 1]
- [Question 2]

### Next Steps
- Review: #${TRACKING_ISSUE}
- Sub-issues: #X, #Y, #Z
- Artifacts: docs/design/${FEATURE_ID}/
```

---

## Guidelines

- **Be opinionated** — Synthesize into recommendations, not just options
- **Persist everything** — All artifacts go to `docs/design/${FEATURE_ID}/`
- **Gate rigorously** — Don't skip gate validation
- **Re-loop when needed** — Don't force forward progress with weak foundations
- **Human checkpoints** — Pause at phase boundaries unless autonomous mode
- **Minimal context per agent** — Each agent gets only what it needs
