---
name: plan
description: "Plan features: evaluate, decompose, impact analysis via Feature Atlas."
---

# Plan Skill

An interactive planning agent that takes ideas or change requests through comprehensive evaluation, decomposition, and impact analysis using the Feature Atlas.

**Configuration**: Read `.claude/project.config.json` for:
- Atlas directory: `paths.atlas_dir`
- Atlas tier paths: `paths.atlas_tiers.strategic`, `.architecture`, `.implementation`
- Feature spec template: `paths.feature_spec_template`

## When to Use This Skill

- "Plan this feature: [description]"
- "Break down issue #123"
- "Run /plan [description or issue number]"
- "Analyze the scope of [change]"
- "Decompose this into sub-issues"
- When you need to understand the full impact of a change
- Before starting any significant implementation work

## Workflow Overview

```
Input: Description or existing issue
              ↓
┌─────────────────────────────────────┐
│ 1. Create/Update Tracking Issue     │
│    (Parent issue for coordination)  │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 2. Load Feature Atlas               │
│    (Full tier1-5 context)           │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 3. Actionability Evaluation         │
│    Is this ready to plan?           │
│    → If unclear: prompt for details │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 4. Size & Complexity Assessment     │
│    How big is this? How many parts? │
│    → If large: decompose further    │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 4.5 Completeness Verification       │
│    Coverage, deps, testability,     │
│    atomicity, ordering + DAG        │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 5. Create Feature Tickets           │
│    Each feature → own GH issue      │
│    Each uses FS template            │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 6. Impact Assessment                │
│    Which tier docs need updates?    │
│    → Create coupled work tickets    │
└─────────────────────────────────────┘
              ↓
Planning complete with full issue tree!
```

---

## Phase 1: Input Handling

### Accept New Description

If user provides a description:
1. Create a parent tracking issue in GitHub
2. Label with `{PLAN_LABEL}` (from config)
3. Use the description as the issue body

```bash
gh issue create \
  --title "[PLAN] Feature Name" \
  --body "## Overview\n\n[Description]\n\n## Status\n\n- [ ] Actionability evaluated\n- [ ] Size assessed\n- [ ] Sub-issues created\n- [ ] Impact analyzed" \
  --label "{PLAN_LABEL},enhancement"
```

### Accept Existing Issue

If user provides an issue number (e.g., `#123` or `123`):
1. Fetch the issue details
2. Use it as the parent tracking issue
3. Add `{PLAN_LABEL}` label if not present

```bash
# Get issue details
gh issue view 123 --json title,body,labels,number,url

# Add plan label if needed
gh issue edit 123 --add-label "{PLAN_LABEL}"
```

---

## Phase 2: Load Feature Atlas

Load the full atlas to understand the system context. Read these documents (use paths from config):

### Tier 1 - Strategic (Why we exist)
Read from `paths.atlas_tiers.strategic` or `{paths.atlas_dir}/tier1-strategic/`:
- Product vision document
- Business requirements document
- Enterprise architecture principles

### Tier 2 - Architecture (How we're built)
Read from `paths.atlas_tiers.architecture` or `{paths.atlas_dir}/tier2-architecture/`:
- System architecture document
- Infrastructure architecture
- Data architecture document

### Tier 3 - Design (How services work)
Read from `paths.atlas_tiers.design` or `{paths.atlas_dir}/tier3-design/`:
- Domain model specification
- API contracts
- Service design documents

### Tier 5 - Reference (Current state)
Read from `{paths.atlas_dir}/tier5-reference/`:
- System map
- Glossary and terminology

### Relevant Feature Docs
Based on the change description, read related feature docs from:
`paths.atlas_features_dir` or `{paths.atlas_dir}/features/`

---

## Phase 3: Actionability Evaluation

Evaluate if the change request is clear enough to plan.

### Actionability Criteria

A change is **actionable** if it has:

1. **Clear Problem Statement**: What problem are we solving?
2. **Defined Scope**: What's in/out of scope?
3. **Success Criteria**: How do we know it's done?
4. **User Context**: Who benefits and how?

### Evaluation Questions

Ask yourself:
1. Can I identify specific files that would change?
2. Can I estimate the number of components involved?
3. Are there ambiguous terms that need definition?
4. Are there multiple valid interpretations?

### If NOT Actionable

Use AskUserQuestion to gather missing details:

```
Questions to clarify:

1. **Problem**: What specific problem does this solve?
   Options:
   - [Specific interpretation A]
   - [Specific interpretation B]
   - Other (please describe)

2. **Scope**: What should be included?
   Options:
   - Minimal (just the core functionality)
   - Standard (core + common use cases)
   - Comprehensive (full feature set)
   - Custom (specify boundaries)

3. **Priority**: How should edge cases be handled?
   Options:
   - Strict (fail on edge cases, fix later)
   - Graceful (handle common edge cases)
   - Robust (handle all foreseeable edge cases)
```

After gathering answers, update the parent issue with clarifications.

---

## Phase 4: Size & Complexity Assessment

### Greenfield vs. Brownfield Detection

Before assessing complexity, determine the change type:

| Type | Signal | Approach |
|------|--------|----------|
| **Greenfield** | New feature, no existing code to modify | Full decomposition into epics → features |
| **Brownfield** | Modifying existing code, adding to existing feature | Scope assessment first, then targeted changes |

**Brownfield indicators**: Issue references existing files, modifies existing behavior, extends current feature, fixes current functionality.

**Greenfield indicators**: No existing code matches the description, new directory/service needed, new domain concept.

For brownfield changes, also list:
- **Files affected**: Which existing files will change?
- **Regression scope**: What existing behavior could break?

### Brownfield Scope Assessment

For brownfield changes, classify scope before planning:

| Scope | Criteria | Planning Approach |
|-------|----------|-------------------|
| **Small (S)** | 1-3 files, single component, no API changes | Direct implementation, minimal planning |
| **Medium (M)** | 4-10 files, crosses component boundaries, minor API changes | Impact analysis required, targeted regression tests |
| **Large (L)** | 11+ files, multiple services, data model changes | Full decomposition, phased rollout plan |

**Medium/Large scope requires:**

1. **Impact Analysis** — For each affected file, document:
   - What changes (function/class/route)
   - What depends on it (callers, importers, consumers)
   - What could break (behavioral changes, type changes, removed exports)

2. **Regression Test Plan** — List tests to run before and after:
   - Existing test suites that cover changed files
   - Manual verification steps for untested paths
   - New tests needed for changed behavior

3. **Rollback Strategy** — For Large scope:
   - Can changes be feature-flagged?
   - Can phases be independently reverted?
   - What is the blast radius of a failed deploy?

### Complexity Dimensions

Evaluate on these dimensions:

| Dimension | Low (1) | Medium (2) | High (3) |
|-----------|---------|------------|----------|
| **Files Changed** | 1-3 | 4-10 | 11+ |
| **Services Affected** | 1 | 2 | 3+ |
| **New APIs** | 0 | 1-2 | 3+ |
| **Data Model Changes** | None | Add fields | New entities |
| **UI Components** | 0-1 | 2-5 | 6+ |
| **Dependencies** | None | Internal only | External |
| **Risk** | Low | Medium | High |

### Scoring

- **Total 1-7**: Small - Single PR, single feature ticket
- **Total 8-14**: Medium - May need 2-3 sub-features
- **Total 15-21**: Large - Needs decomposition into multiple features

### Decomposition Rules

1. **Single Feature**: One cohesive piece of functionality
2. **Maximum Scope**: Each feature should be completable in 1-3 PRs
3. **Clear Boundaries**: Features should have minimal cross-dependencies
4. **Independent Testing**: Each feature can be tested in isolation

### Decomposition Process

If complexity > 14 or multiple distinct features identified:

1. Identify logical feature boundaries
2. Create sub-issues for each feature
3. Link sub-issues to parent
4. Repeat assessment for each sub-issue

```bash
# Create sub-issue
gh issue create \
  --title "[FS] Sub-Feature Name" \
  --body "$(cat <<'EOF'
## Parent Issue
Tracked by #PARENT_NUMBER

## Feature Overview
[Description of this specific feature]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Technical Notes
[Key implementation considerations]

---
*This is a Feature Specification (FS) sub-issue.*
EOF
)" \
  --label "enhancement,{TEMPLATE_LABEL}"

# Link to parent
gh issue edit PARENT_NUMBER --body "Updated body with sub-issue links"
```

### Hypothesis Tracking (FPF Integration)

After scoring complexity, classify each plan step as a hypothesis using the FPF Trust Calculus (see `.claude/agents/fpf-agent.md`):

1. **Assign L0 to each plan step** -- Every decomposed feature or sub-issue starts as an L0 (abductive guess) with an initial R_eff score.

2. **Catalog evidence per step** -- For each step, list supporting evidence (codebase analysis, prior art, architecture constraints) with reliability scores.

3. **Compute R_eff for the plan** -- The overall plan reliability is bounded by its weakest step:
   ```
   Plan_R_eff = min(Step_R_eff for all steps)
   ```

4. **Flag low-confidence steps** -- Any step with R_eff < 0.3 needs additional evidence before proceeding to implementation.

5. **Track promotions** -- Steps are promoted as verification occurs:
   - **L0 to L1**: Completeness verification passes (Phase 4.5)
   - **L1 to L2**: Implementation tests pass (during /build or /execute)

Include a hypothesis summary table in the parent issue:

```markdown
## Hypothesis Tracking

| Step | Hypothesis | Level | R_eff | Weakest Link | Status |
|------|-----------|-------|-------|--------------|--------|
| 1 | [description] | L0 | 0.X | [evidence] | active |
| 2 | [description] | L0 | 0.X | [evidence] | active |
```

For irreversible steps (data model changes, API contracts), require R_eff >= 0.6 before approving the plan.

---

## Phase 4.5: Completeness Verification

After decomposing into sub-issues, run the completeness loop before creating detailed tickets. This catches gaps early.

### Completeness Loop

For each sub-issue, verify against 5 checks:

| Check | Question | Pass Criteria |
|-------|----------|---------------|
| **Coverage** | Does every requirement from the parent map to at least one sub-issue? | No orphan requirements |
| **Dependencies** | Are all dependencies between sub-issues explicit? | Each sub-issue lists what it depends on |
| **Testability** | Does each sub-issue have verifiable acceptance criteria? | 2+ acceptance criteria per issue |
| **Atomicity** | Is each sub-issue one cohesive thing? | Can describe in 1 sentence without "and" |
| **Ordering** | Is the build order clear from dependencies? | At least 1 sub-issue has no dependencies (can start immediately) |

### Verification Table

Before proceeding, fill this table:

```markdown
## Plan Verification

| Check | Status | Notes |
|-------|--------|-------|
| Coverage | ✅/❌ | [orphan requirements if any] |
| Dependencies | ✅/❌ | [missing deps if any] |
| Testability | ✅/❌ | [issues without acceptance criteria] |
| Atomicity | ✅/❌ | [issues that need splitting] |
| Ordering | ✅/❌ | [circular deps or missing start point] |
```

**If any check fails**: Fix the specific issue (split, add criteria, add dependency) and re-verify. Max 2 iterations.

### Dependency DAG

Visualize the dependency graph in the parent issue:

```markdown
## Dependency Order

#101 [FS] Database Schema (no deps — start here)
  ↓
#102 [FS] API Layer (depends on #101)
  ↓
#103 [FS] UI Components (depends on #102)
  ↓
#104 [FS] Integration Tests (depends on #102, #103)
```

**No circular dependencies allowed.** If found, restructure the decomposition.

### Regression Checklist (Brownfield Only)

For brownfield changes, add to the parent issue:

```markdown
## Regression Checklist
- [ ] [Existing feature 1] still works
- [ ] [Existing feature 2] still works
- [ ] All existing tests pass
```

---

## Phase 5: Create Feature Tickets

For each identified feature, create a detailed ticket using the FS template.

### Plan Header with Execution Directive

Every implementation plan MUST include this header to enable seamless handoff to execution:

```markdown
# [Feature Name] Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use /execute to implement this plan task-by-task.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Complexity:** [low|medium|high]

---
```

This directive signals to subagents to auto-invoke the execution skill, creating smooth plan→execute handoff.

### Feature Ticket Structure

Each feature ticket must include:

```markdown
# Feature Specification: [Feature Name]

## Metadata
- **Feature ID**: FS-[NUMBER]
- **Parent Issue**: #[PARENT]
- **Status**: draft

## Overview
### Summary
[2-3 sentence description]

### Business Value
[Why this matters]

### Success Metrics
- [Metric 1]
- [Metric 2]

## Requirements

### Functional Requirements
| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|---------------------|
| FR-001 | [Requirement] | must-have | Given [X], when [Y], then [Z] |

### Non-Functional Requirements
- **Performance**: [Target]
- **Reliability**: [Target]
- **Security**: [Requirements]

## Technical Design

### Files to Create/Modify
| File | Change Type | Purpose |
|------|-------------|---------|
| [path] | create/modify | [why] |

### Data Model Changes
[Schema changes if any]

### API Changes
[Endpoint additions/modifications]

## Edge Cases
| ID | Scenario | Expected Behavior |
|----|----------|-------------------|
| EC-001 | [Scenario] | [Behavior] |

## Testing Requirements
- [ ] Unit tests for [component]
- [ ] Integration tests for [flow]
- [ ] E2E test for [user journey]

## Dependencies
- Depends on: #[issue]
- Blocks: #[issue]
```

### Labeling

Apply appropriate labels:
- `enhancement` - For new features
- `{TEMPLATE_LABEL}` - To trigger template generation (from config)
- `{ENRICHED_LABEL}` - After spec is complete (from config)

---

## Phase 6: Impact Assessment

Using the loaded atlas, identify what documentation and infrastructure needs to change.

### Impact Categories

#### Tier 1 Impact (Strategic)
Rarely affected. Check if change:
- Alters product vision or goals
- Changes business capabilities
- Affects security policy
- Has compliance implications

#### Tier 2 Impact (Architecture)
Check if change:
- Adds new AWS services
- Modifies system boundaries
- Changes data architecture
- Affects security patterns

#### Tier 3 Impact (Design)
Common impact area. Check if change:
- Adds/modifies domain entities
- Changes API contracts
- Alters service responsibilities
- Adds new events or workflows

#### Tier 4 Impact (Implementation)
Check if change:
- Needs new runbook procedures
- Requires new feature spec examples
- Changes testing patterns

#### Tier 5 Impact (Reference)
Almost always affected. Check:
- System map needs update (new routes, APIs)
- Glossary needs new terms
- Decision log needs new ADR
- Code standards affected

### Feature Doc Impact
Check if change:
- Creates new feature (needs new doc)
- Modifies existing feature (update doc)
- Deprecates feature (mark for removal)

### Creating Impact Tickets

For each identified impact, create a coupled work ticket:

```bash
gh issue create \
  --title "[DOCS] Update [tier/doc] for [feature]" \
  --body "## Related Feature
Coupled with #FEATURE_NUMBER

## Documentation Change
- **Document**: docs/atlas/[path]
- **Change Type**: create|update|deprecate
- **Sections Affected**:
  - [Section 1]
  - [Section 2]

## Content to Add/Update
[Description of what needs to change]

---
*This is a documentation coupling issue.*" \
  --label "documentation,{BUILD_LABEL}"
```

---

## Output Format

After completing all phases, provide a summary:

```markdown
## Planning Complete

### Parent Issue
**#[NUMBER]**: [Title]
- URL: [link]
- Status: Decomposed and analyzed

### Complexity Assessment
- **Total Score**: [X]/21
- **Classification**: Small|Medium|Large
- **Features Identified**: [N]

### Feature Issues Created

| Issue | Title | Complexity | Dependencies |
|-------|-------|------------|--------------|
| #[N] | [FS] Feature A | Medium | None |
| #[N] | [FS] Feature B | Low | #[A] |

### Impact Assessment

#### Documentation Updates Needed
| Tier | Document | Change Type | Issue |
|------|----------|-------------|-------|
| 3 | API Contract | Update | #[N] |
| 5 | System Map | Update | #[N] |

#### No Impact
- Tier 1: No changes needed
- Tier 4: No changes needed

### Issue Tree
```
#[PARENT] [PLAN] Main Feature
├── #[A] [FS] Sub-Feature A
│   └── #[D] [DOCS] Update API Contract
├── #[B] [FS] Sub-Feature B
└── #[C] [DOCS] Update System Map
```

### Execution Handoff

Plan complete. Two execution options:

1. **Subagent-Driven** — Fresh subagent per task, review between tasks, fast iteration
2. **Parallel Session** — Open new session with /execute, batch execution with checkpoints

Which approach?

### Next Steps
1. Review feature specifications in each [FS] issue
2. Add `{BUILD_LABEL}` label (from config) to issues when ready for implementation
3. Prioritize based on dependencies
```

---

## Instructions for AI

When executing this skill:

### 1. Input Parsing
- Check if input is an issue number (numeric) or description (text)
- For issue numbers: fetch and use as parent
- For descriptions: create new parent issue

### 2. Atlas Loading
- Read all tier1-3 docs for context
- Read tier5 system-map and glossary
- Read relevant feature docs based on keywords in the description

### 3. Interactive Clarification
- If change is ambiguous, USE AskUserQuestion
- Don't assume - ask for specifics
- Update parent issue with clarifications

### 4. Decomposition
- Be aggressive about splitting large changes
- Each feature should be independently implementable
- Prefer more smaller issues over fewer large ones

### 5. FS Template
- Every feature issue MUST use the FS structure
- Include concrete file paths where possible
- Define clear acceptance criteria

### 6. Impact Analysis
- Check EVERY tier for potential impact
- When in doubt, create an impact ticket
- Link all tickets to the parent

### 7. GitHub Operations
- Use `gh` CLI for all GitHub operations
- Always link child issues to parent
- Apply correct labels consistently

### 8. Iteration
- If user provides more details, re-run affected phases
- Keep parent issue updated with current status
- Mark completed phases in parent issue checklist

---

## Example Session

```
User: /plan Add real-time collaboration to the dashboard

AI: I'll help you plan this feature. Let me start by creating a tracking issue.

[Creates parent issue #200]

Loading Feature Atlas for context...
[Reads tier 1-3, tier 5 reference, and dashboard feature docs]

This is a significant change. I need some clarifications:

[AskUserQuestion]
1. Scope: What should be collaborative?
   - Document editing only
   - All dashboard views
   - Specific features (please specify)

2. Conflict resolution: How should conflicts be handled?
   - Last-write-wins
   - Operational transformation
   - CRDT-based

3. Presence: Should users see who else is viewing?
   - Yes, with cursors
   - Yes, basic presence only
   - No presence features

User:
1. Document editing only
2. CRDT-based
3. Yes, with cursors

AI: Got it. Updating the parent issue with these clarifications...

Assessing complexity...
- Files Changed: High (15+)
- Services Affected: Medium (Dashboard + new WebSocket service)
- New APIs: High (WebSocket + REST endpoints)
- Data Model: High (CRDT state, presence, cursors)
- UI Components: High (8+ new components)
- Dependencies: High (CRDT library)
- Risk: High (Real-time systems are complex)

Total: 20/21 - Large, requires decomposition

I've identified 4 distinct features:

1. **WebSocket Infrastructure** - Base real-time transport
2. **CRDT State Management** - Conflict-free data sync
3. **Presence System** - User awareness and cursors
4. **Collaborative Editor Integration** - UI components

Creating feature issues...

[Creates #201 [FS] WebSocket Infrastructure]
[Creates #202 [FS] CRDT State Management - depends on #201]
[Creates #203 [FS] Presence System - depends on #201]
[Creates #204 [FS] Collaborative Editor - depends on #202, #203]

Running impact assessment...

Documentation updates needed:
- Tier 2: AWS Infrastructure (new WebSocket API Gateway)
- Tier 3: Dashboard Service Design (new collaboration module)
- Tier 3: API Contract (new endpoints)
- Tier 5: System Map (new routes and components)

Creating documentation issues...
[Creates #205 [DOCS] Update AWS Infrastructure]
[Creates #206 [DOCS] Update Dashboard Service Design]
[Creates #207 [DOCS] Update API Contract]
[Creates #208 [DOCS] Update System Map]

## Planning Complete

### Parent Issue
**#200**: [PLAN] Add real-time collaboration
- Status: Decomposed

### Features Created
| Issue | Title | Complexity |
|-------|-------|------------|
| #201 | WebSocket Infrastructure | Medium |
| #202 | CRDT State Management | High |
| #203 | Presence System | Medium |
| #204 | Collaborative Editor | High |

### Documentation Issues
| Issue | Document | Change |
|-------|----------|--------|
| #205 | AWS Infrastructure | Update |
| #206 | Dashboard Service Design | Update |
| #207 | API Contract | Update |
| #208 | System Map | Update |

### Issue Tree
#200 [PLAN] Real-time Collaboration
├── #201 [FS] WebSocket Infrastructure
├── #202 [FS] CRDT State Management
├── #203 [FS] Presence System
├── #204 [FS] Collaborative Editor
├── #205 [DOCS] AWS Infrastructure
├── #206 [DOCS] Dashboard Service
├── #207 [DOCS] API Contract
└── #208 [DOCS] System Map

### Next Steps
1. Review each [FS] issue specification
2. Start with #201 (no dependencies)
3. Add `{BUILD_LABEL}` label (from config) when ready
```

---

## Error Handling

- **GitHub API errors**: Retry with exponential backoff, report if persistent
- **Missing atlas docs**: Note which docs are missing, continue with available context
- **Ambiguous input**: Always ask for clarification, never assume
- **Circular dependencies**: Flag and ask user to resolve
- **Large decomposition**: If >10 features identified, group into epics first