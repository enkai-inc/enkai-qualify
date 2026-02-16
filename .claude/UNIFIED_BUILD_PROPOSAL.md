# Unified Build System Proposal

## Executive Summary

A complete workflow system with four phases:

1. **RESEARCH** — UX defines the problem, conducts context-aware research
2. **DESIGN** — Double Diamond (Discover → Define → Develop → Deliver) with 9 subagents
3. **PLAN** — Decomposes into workable tasks, writes specs
4. **BUILD** — Scrum Master grooms, 6x Codex Builders execute

**Key principle**: Human-driven research and design. Machine-driven execution.

---

## Roles

| Phase | Role | Agent | Human? | Description |
|-------|------|-------|--------|-------------|
| **RESEARCH** | UX | Claude | ✅ | Defines problem, conducts context-aware research |
| **DESIGN** | Product Manager | Claude | ✅ | North star, PRD, success metrics, release readiness |
| **DESIGN** | UX Researcher | Claude | ✅ | Research plan, interviews, usability testing |
| **DESIGN** | Product Designer | Claude | ✅ | Empathy maps, user journeys, wireframes, UI spec |
| **DESIGN** | Tech Lead | Claude | ✅ | Feasibility, architecture, TDD, data model |
| **DESIGN** | Stakeholder | Claude | ✅ | Alignment, decision log, gate validation |
| **DESIGN** | Engineer | Claude | ✅ | Spikes, implementation plan |
| **DESIGN** | Content Strategist | Claude | ✅ | Voice/tone, microcopy |
| **DESIGN** | QA Engineer | Claude | ✅ | Test plan, bug triage |
| **DESIGN** | Product Marketer | Claude | ✅ | Launch plan, release notes, enablement |
| **PLAN** | Planner | Claude | ✅ | Decomposes into epics + feature specs |
| **BUILD** | Scrum Master | Claude | 🤖 | Grooms issues, generates Work Unit specs |
| **BUILD** | Builder | Codex (x6) | 🤖 | Mechanically applies code and verifies |

---

## Complete Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RESEARCH (Human)                                │
│  UX → research → gh issue + research report                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DESIGN — Double Diamond (Human)                     │
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │  DISCOVER   │───▶│   DEFINE    │───▶│   DEVELOP   │───▶│   DELIVER   │  │
│  │ (divergent) │    │ (convergent)│    │ (divergent) │    │ (convergent)│  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│        │                  │                  │                  │           │
│        ▼                  ▼                  ▼                  ▼           │
│   gate-result.json   gate-result.json   gate-result.json   gate-result.json│
│   8 artifacts        9 artifacts        8 artifacts        5 artifacts     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PLAN (Human)                                    │
│  plan → epic + feature specs (gh issues)                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BUILD (Machine)                                 │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      SCRUM MASTER (Claude)                           │   │
│  │  eval → stories, tasks, feature specs (gh issues)                   │   │
│  │  scrum → break down work into stories + tasks                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│            ┌───────┬───────┬───────┼───────┬───────┐                       │
│            ▼       ▼       ▼       ▼       ▼       ▼                       │
│          B1      B2      B3      B4      B5      B6                        │
│        (Codex) (Codex) (Codex) (Codex) (Codex) (Codex)                     │
│            │       │       │       │       │       │                       │
│            └───────┴───────┴───────┼───────┴───────┘                       │
│                                    ▼                                        │
│                                  PRs                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: RESEARCH

**Role**: UX
**Verb**: research
**Description**: Defines the problem to be solved and conducts context-aware research on a topic

### Artifacts

| Artifact | Description |
|----------|-------------|
| `gh issue` | Tracking issue for the research |
| `research-report.md` | Findings, insights, recommendations |

### Human Checkpoint

✅ Human reviews research report before proceeding to DESIGN

---

## Phase 2: DESIGN (Double Diamond)

Four sub-phases with gate validation between each. Uses 9 specialized subagents.

### Directory Structure

```
docs/design/${FEATURE_ID}/
├── status.yml                    # Phase status + gate results
├── decision-log.md               # All decisions with rationale
├── open-questions.md             # Unresolved questions
│
├── discover/                     # Phase 1: Divergent
│   ├── ecosystem-map.md
│   ├── empathy-maps.md
│   ├── feasibility-constraints.md
│   ├── interview-guide.md
│   ├── market-competitors.md
│   ├── north-star.md
│   ├── opportunity-backlog.md
│   └── research-plan.md
│
├── define/                       # Phase 2: Convergent
│   ├── architecture-sketch.md
│   ├── core-data-model.md
│   ├── gate-result.json
│   ├── mvp-scope.md
│   ├── prd.md
│   ├── problem-statement.md
│   ├── stakeholder-review.md
│   ├── success-metrics.md
│   └── user-journeys.md
│
├── develop/                      # Phase 3: Divergent
│   ├── gate-result.json
│   ├── ia-sitemap.md
│   ├── microcopy-inventory.md
│   ├── tdd.md
│   ├── ui-spec.md
│   ├── usability-test-plan.md
│   ├── voice-and-tone.md
│   └── wireframes.md
│
└── deliver/                      # Phase 4: Convergent
    ├── gate-result.json
    ├── launch-plan.md
    ├── release-notes.md
    ├── sales-support-enablement.md
    └── test-plan.md
```

### Phase 2a: DISCOVER (Divergent)

**Goal**: Understand the problem space and empathize with users

**Subagents** (run in parallel):
- `design-product-manager` → north-star, market-competitors, opportunity-backlog
- `design-ux-researcher` → research-plan, interview-guide
- `design-product-designer` → empathy-maps, ecosystem-map
- `design-tech-lead` → feasibility-constraints

| Artifact | Description |
|----------|-------------|
| `north-star.md` | North Star Metric, target segment, input metrics |
| `market-competitors.md` | Competitors, differentiation, risks |
| `opportunity-backlog.md` | Prioritized opportunities with confidence levels |
| `research-plan.md` | Research questions, recruiting criteria, methods |
| `interview-guide.md` | Script and questions for user interviews |
| `empathy-maps.md` | User thinks/feels/says/does |
| `ecosystem-map.md` | User's environment and touchpoints |
| `feasibility-constraints.md` | Known constraints, unknowns, risk register |

**Gate Checklist**:
- [ ] Target user + context stated without ambiguity
- [ ] Top opportunities listed with confidence labels
- [ ] Research plan exists
- [ ] Constraints + unknowns enumerated
- [ ] Open questions logged

### Phase 2b: DEFINE (Convergent)

**Goal**: Narrow research into a clear, actionable brief

**Subagents** (sequential with parallel group):
1. `design-product-manager` → problem-statement, prd, mvp-scope, success-metrics
2. (parallel) `design-product-designer` → user-journeys + `design-tech-lead` → architecture-sketch, core-data-model
3. `design-stakeholder` → stakeholder-review, decision-log updates

| Artifact | Description |
|----------|-------------|
| `problem-statement.md` | Target user, JTBD, desired outcome, constraints |
| `prd.md` | Requirements with acceptance criteria |
| `mvp-scope.md` | In-scope, out-of-scope, non-goals, success criteria |
| `success-metrics.md` | KPIs, definitions, measurement plan |
| `user-journeys.md` | Step-by-step user flows with moments of truth |
| `architecture-sketch.md` | Data flow, key components |
| `core-data-model.md` | Entities, relationships, tenancy |
| `stakeholder-review.md` | Approved/blocked status, required changes |
| `gate-result.json` | Machine-readable gate validation result |

**Gate Checklist**:
- [ ] Problem statement is single-sentence clear + testable
- [ ] MVP scope is explicit (in/out, non-goals)
- [ ] PRD has acceptance criteria per requirement
- [ ] Success metrics are measurable
- [ ] Architecture + data model are plausible
- [ ] Stakeholders approved

### Phase 2c: DEVELOP (Divergent)

**Goal**: Explore solutions, prototype, converge on buildable plan

**Subagents** (parallel then sequential):
1. (parallel) `design-product-designer`, `design-tech-lead`, `design-ux-researcher`, `design-content-strategist`
2. `design-engineer` → spikes, implementation plan

| Artifact | Description |
|----------|-------------|
| `ia-sitemap.md` | Routes, navigation structure |
| `wireframes.md` | Low-fidelity screen layouts |
| `ui-spec.md` | States (loading/empty/error/success), accessibility, responsive |
| `tdd.md` | API contracts, data, security, observability, error handling |
| `usability-test-plan.md` | Tasks, success criteria, moderation script |
| `voice-and-tone.md` | Brand voice guidelines |
| `microcopy-inventory.md` | Screen, element, copy for all UI text |
| `gate-result.json` | Machine-readable gate validation result |

**Gate Checklist**:
- [ ] UI spec includes all states + a11y notes
- [ ] TDD includes API contracts + data model alignment
- [ ] Unknowns resolved or queued as spikes
- [ ] Usability plan exists
- [ ] Implementation plan derivable from PRD + TDD + UI spec

### Phase 2d: DELIVER (Convergent)

**Goal**: Build, validate, launch

**Subagents** (sequential with parallel group):
1. `design-engineer` → implement + tests
2. (parallel) `design-qa-engineer`, `design-product-marketer`, `design-content-strategist`
3. `design-product-manager` → release readiness sign-off

| Artifact | Description |
|----------|-------------|
| `test-plan.md` | Smoke, regression, edge cases |
| `release-notes.md` | What changed, how to use, known issues |
| `launch-plan.md` | Timeline, channels, owners |
| `sales-support-enablement.md` | FAQ, demo script, troubleshooting |
| `gate-result.json` | Machine-readable gate validation result |

**Gate Checklist**:
- [ ] All PRD acceptance criteria implemented or explicitly deferred
- [ ] Tests pass
- [ ] QA signoff
- [ ] Release notes + docs complete
- [ ] Success metrics instrumentation in place
- [ ] Rollback plan exists

### Artifact Hygiene (All Phases)

Every artifact must contain:
- `# Title`
- `## TLDR` (500-1000 chars for downstream agents)
- `Owner:` and `Last updated:` metadata
- `## Evidence` section
- `## Assumptions` section
- `## Decisions` section
- `## Open Questions` section

### Gate Validation

Each phase produces a `gate-result.json`:

```json
{
  "feature_id": "GH-123",
  "gate": "define",
  "status": "COMPLETE",
  "missing_files": [],
  "failed_checks": [],
  "blocking_issues": [],
  "reloop": "none",
  "evidence_refs": ["docs/design/GH-123/define/prd.md#L45"],
  "summary": "All Define artifacts complete. PRD has 8 requirements..."
}
```

Status values: `COMPLETE` | `INCOMPLETE` | `BLOCKED`

### Re-loop Triggers

| From | Back To | When |
|------|---------|------|
| Define | Discover | Conflicting ICP assumptions, no evidence path |
| Develop | Define | Usability invalidates problem, TDD requires re-scope |
| Deliver | Develop | Severe usability issues, systemic QA failures |
| Deliver | Define | Requirements change, core value prop no longer holds |

---

## Phase 3: PLAN

**Role**: Planner
**Verb**: plan
**Description**: Decomposes into workable tasks, writes specs

### Artifacts

| Artifact | Description |
|----------|-------------|
| `epic` | GitHub issue representing the overall feature |
| `feature-specs/` | Individual feature specification files |

Each feature spec includes:
- Overview
- Context from Design phase
- Acceptance criteria (from PRD)
- Technical approach (from TDD)
- Files to create/modify
- Dependencies
- Estimated complexity

### Human Checkpoint

✅ Human reviews epic + feature specs before BUILD

---

## Phase 4: BUILD

**Roles**: Scrum Master (Claude) + Builders (6x Codex)
**Human**: 🤖 Machine-driven

### Stage 4a: Eval

**Role**: Scrum Master
**Verb**: eval
**Description**: Evaluates specs and ensures they are ready

| Artifact | Description |
|----------|-------------|
| `stories` | User stories (GitHub issues) |
| `tasks` | Technical tasks (GitHub issues) |
| `feature specs` | Linked feature specifications |

### Stage 4b: Scrum

**Role**: Scrum Master
**Verb**: scrum
**Description**: Break down work into stories and tasks as GitHub issues

Decomposes until each task is **Codex-simple**:
- ≤2 files
- ≤50 lines
- 0 decisions required
- <5 minutes to implement

Produces **Work Unit Specs**:

```yaml
work_unit:
  id: "issue-123-wu-004"
  parent_issue: 123
  sequence: 4
  summary: "Add password hash utility"

  context:
    files:
      - path: "src/utils/crypto.ts"
        relevant_lines: "1-25"
    patterns:
      - "Follow async/await pattern from src/utils/db.ts"
    constraints:
      - "Use bcrypt with cost factor 12"

  implementation:
    - file: "src/utils/crypto.ts"
      action: "append"
      code: |
        // Pre-written code here

  tests:
    file: "src/utils/__tests__/crypto.test.ts"
    code: |
      // Pre-written test code here

  verification:
    commands:
      - "npx tsc --noEmit"
      - "npm test -- crypto.test.ts"
    success_criteria:
      - "Exit code 0"
      - "3 tests pass"

  commit:
    message: "feat(auth): add password hash utility"
```

### Stage 4c: Build

**Role**: Builder (6x Codex in parallel)
**Verb**: build
**Description**: Build agents execute Work Units mechanically

Each Builder:
1. Receives ONE Work Unit spec
2. Reads ONLY specified context files
3. Applies implementation code exactly
4. Applies test code exactly
5. Runs verification commands
6. Commits with specified message
7. Returns Result JSON

```json
{
  "work_unit_id": "issue-123-wu-004",
  "success": true,
  "commit_sha": "abc123",
  "verification_output": "...",
  "error": null
}
```

### Stage 4d: Aggregation

Scrum Master aggregates completed Work Units into PRs:
- One PR per original issue
- Cherry-picks all Work Unit commits
- Updates issue with PR link

---

## Artifact Summary by Phase

| Phase | Artifacts | Persisted | Human? |
|-------|-----------|-----------|--------|
| **RESEARCH** | gh issue, research-report.md | GitHub | ✅ |
| **DESIGN: Discover** | 8 markdown files | Git | ✅ |
| **DESIGN: Define** | 9 markdown files + gate-result.json | Git | ✅ |
| **DESIGN: Develop** | 8 markdown files + gate-result.json | Git | ✅ |
| **DESIGN: Deliver** | 5 markdown files + gate-result.json | Git | ✅ |
| **PLAN** | epic (issue), feature specs | GitHub + Git | ✅ |
| **BUILD: Eval** | stories, tasks (issues) | GitHub | 🤖 |
| **BUILD: Scrum** | Work Unit Specs | Memory | 🤖 |
| **BUILD: Build** | commits, Result JSONs | Git + Memory | 🤖 |
| **BUILD: Aggregate** | PRs | GitHub | 🤖 |

**Total Design Artifacts**: 30+ markdown files across 4 phases

---

## Depth Modes (Design Phase)

| Mode | Phases | Use Case |
|------|--------|----------|
| `full` | Discover → Define → Develop → Deliver | Major features, complex initiatives |
| `lightweight` | Discover → Define | Smaller features, well-understood domains |
| `discover-only` | Discover | Research spikes, feasibility checks |

---

## Skills Mapping

| Current Skill | New Role/Phase | Notes |
|---------------|----------------|-------|
| `/design` | DESIGN (all 4 phases) | Expanded to full Double Diamond |
| `/plan` | PLAN | Unchanged |
| `/scrum` | BUILD: Scrum Master | Absorbed eval + decomposition |
| `/eval` | BUILD: Scrum Master (eval) | Absorbed |
| `/build` | BUILD: Builders | Codex execution |
| `/execute` | BUILD: Builders | Absorbed |
| `/feature-dev` | DESIGN + BUILD | Workflow absorbed |
| `/bug` | BUILD: Scrum Master | Fast path for simple fixes |
| `/confidence-check` | DESIGN: Define gate | Absorbed into gate validation |

---

## Implementation Checklist

### Phase 1: Create Design Agents
- [ ] `design-product-manager.md`
- [ ] `design-ux-researcher.md`
- [ ] `design-product-designer.md`
- [ ] `design-tech-lead.md`
- [ ] `design-stakeholder.md`
- [ ] `design-engineer.md`
- [ ] `design-content-strategist.md`
- [ ] `design-qa-engineer.md`
- [ ] `design-product-marketer.md`

### Phase 2: Create Gate Validator
- [ ] `GATE_VALIDATOR.yml` — validation rules per phase
- [ ] `gate-validator-output.schema.json` — result schema
- [ ] `validator-prompt.txt` — LLM prompt for validation

### Phase 3: Create Orchestrator
- [ ] `ORCHESTRATOR.md` — runbook for full workflow
- [ ] Status tracking (`status.yml` template)
- [ ] Dashboard sync helpers (S3 + DynamoDB)

### Phase 4: Create Design Directory Structure
- [ ] Template for `docs/design/${FEATURE_ID}/`
- [ ] Artifact templates for each phase

### Phase 5: Update Build System
- [ ] Scrum Master skill (35KB)
- [ ] Builder agent template (3KB)
- [ ] Work Unit Spec schema

### Phase 6: Migration
- [ ] Archive old skills
- [ ] Update CLAUDE.md
- [ ] Update skill-rings.json
- [ ] Create backward-compatible aliases

---

## Status Tracking

Each feature maintains a `status.yml` in its design directory:

```yaml
feature_id: "GH-123"
current_phase: "design_define"
phase_history:
  - phase: "research"
    started_at: "2026-02-10T10:00:00Z"
    completed_at: "2026-02-10T14:30:00Z"
  - phase: "design_discover"
    started_at: "2026-02-10T14:30:00Z"
    completed_at: "2026-02-11T09:00:00Z"
  - phase: "design_define"
    started_at: "2026-02-11T09:00:00Z"
    completed_at: null
blocking_issues: []
last_activity: "2026-02-11T16:45:00Z"
```

This enables:
- Resuming work after interruption
- Tracking phase duration for estimation
- Identifying blocked features

---

## Acceptance Criteria

- [ ] `/design` runs full Double Diamond with 9 subagents
- [ ] Gate validation produces `gate-result.json` at each phase
- [ ] Re-loop triggers work correctly
- [ ] `/plan` produces epic + feature specs
- [ ] `/scrum` decomposes to Codex-simple Work Units
- [ ] 6 Codex Builders execute in parallel
- [ ] One PR per original issue
- [ ] 30+ design artifacts persisted to git
- [ ] Human checkpoints enforced between phases

---

## Supersedes

This proposal supersedes #109 (original consolidation proposal).
