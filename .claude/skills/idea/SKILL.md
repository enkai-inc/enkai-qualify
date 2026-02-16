---
name: idea
description: "Capture ideas: brainstorm, research, plan, template generation."
---

# Idea Skill

An interactive agent that captures ideas and runs them through a feature development workflow: research, planning, template generation, and requirements gathering.

**Configuration**: Read `.claude/project.config.json` for:
- API endpoints: `aws.services.api_url` or similar
- Atlas/docs paths: `paths.atlas_dir`, `paths.feature_spec_template`

## When to Use This Skill

- "I have an idea for..."
- "Add a new feature idea"
- "Create idea: [description]"
- "Run /idea [description]"
- When you want to capture and develop a feature idea

## Mode Selection

At the start, determine the execution mode:

| Mode | Description | When to use |
|------|-------------|-------------|
| **Autonomous** | Run all 5 phases, present final PRD | User wants speed, will review at end |
| **Interactive** | Step through each phase with user | User wants to shape direction at each phase |

Default to **Interactive** unless user says "just do it" or "autonomous".

## Workflow Overview

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 1/5: EXPLORE THE IDEA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 2/5: MARKET RESEARCH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 3/5: TARGET USERS & JOURNEYS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 4/5: FEATURES & PRIORITIZATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 5/5: REVIEW & FINALIZE PRD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Phase 1: Explore the Idea

Use three techniques to deepen understanding:

1. **5 Whys** — Ask "why" 5 times to find the core motivation
2. **Crazy 8s** — Generate 8 variant angles on the idea in 2 minutes
3. **Devil's Advocate** — Challenge: Is this actually needed? What already exists?

### Phase 2: Market Research

Use WebSearch to find:
- Top 3-5 competitors or existing solutions
- Their strengths and weaknesses
- User complaints (reviews, forums, GitHub issues)
- Market gaps the idea could fill

### Phase 3: Target Users & Journeys

Define:
- **2 personas** (demographics, goals, pains, current solution, switching motivation)
- **3 core journeys**: Onboarding, Main action, Return visit

### Phase 4: Features & MoSCoW Prioritization

Categorize all features using MoSCoW:

| Priority | Meaning | Criteria |
|----------|---------|----------|
| **Must** | Critical for MVP | Product fails without it |
| **Should** | Important but not blocking | Significant value, can ship without |
| **Could** | Nice to have | Improves experience, low effort |
| **Won't** | Out of scope for v1 | Deferred to future iteration |

Output the features table:
```markdown
| Priority | Feature | Rationale |
|----------|---------|-----------|
| Must | User authentication | Core security requirement |
| Must | Data export | Key differentiator |
| Should | Dark mode | User expectation, not blocking |
| Could | Keyboard shortcuts | Power user feature |
| Won't | Mobile app | Separate initiative |
```

### Phase 5: Review & Finalize

Run Devil's Advocate one more time:
- Is the MVP scope realistic for 1-2 sprints?
- Are the "Must" features actually must-haves?
- What risks are missing?
- Is the technical approach sound?

Output the final PRD with all sections.

## Workflow Steps

### Step 1: Gather Idea Details

If the user provides a brief description, ask clarifying questions:

Use AskUserQuestion to gather:
1. **Title**: Short, descriptive name (required)
2. **Description**: Detailed explanation of the feature (required)
3. **Priority**: low | medium | high | critical (default: medium)
4. **Workflow options**: Which workflows to run

Example prompt:
```
Questions:
1. Title: What's a short name for this idea?
2. Priority: How urgent is this feature?
   - Low (nice to have)
   - Medium (should have)
   - High (important)
   - Critical (urgent)
3. Workflows: Which AI workflows should we run?
   - Research only (deep AI analysis)
   - Plan only (implementation approach)
   - Both research and plan
   - Skip AI workflows (just create and template)
```

### Step 2: Create the Idea

If your project has an Ideas API, call it to create the idea. Otherwise, create a GitHub issue directly:

**Option A: Using Ideas API (if available)**

```bash
# Read API URL from .claude/project.config.json: aws.services.api_url
API_URL="{read from config}"

curl -X POST ${API_URL}/api/ideas \
  -H "Content-Type: application/json" \
  -d '{
    "title": "TITLE",
    "description": "DESCRIPTION",
    "priority": "PRIORITY",
    "triggerResearch": true,
    "triggerPlan": true
  }'
```

**Option B: Create GitHub Issue directly**

```bash
gh issue create \
  --title "Idea: TITLE" \
  --body "DESCRIPTION\n\nPriority: PRIORITY" \
  --label "idea"
```

**Response includes:**
- `id` or issue number
- `issueUrl`: Link to the GitHub issue

### Step 3: Monitor Research (if triggered)

If research was triggered, poll for completion:

```bash
# Check research status
curl {API_URL}/api/ideas/{id}/research
```

Poll every 10-15 seconds until `status` is not `running`.

When complete, display:
- Research findings summary
- Key insights discovered
- Recommendations

### Step 4: Monitor Plan (if triggered)

If planning was triggered, poll for completion:

```bash
# Check plan status
curl {API_URL}/api/ideas/{id}/plan
```

Poll every 10-15 seconds until `status` is not `running`.

When complete, display:
- Implementation approach
- Technical considerations
- Estimated complexity

### Step 5: Monitor Template Generation

Template generation is auto-triggered on creation. Poll for completion:

```bash
# Check template status
curl {API_URL}/api/ideas/{id}/template
```

When complete, display:
- Problem statement
- Proposed solution
- Success criteria
- Technical approach

### Step 6: Trigger Requirements (Optional)

Ask user if they want to gather detailed requirements:

```bash
# Trigger requirements gathering
curl -X POST {API_URL}/api/ideas/{id}/requirements
```

Poll for completion:
```bash
curl {API_URL}/api/ideas/{id}/requirements
```

When complete, display:
- Readiness status
- Any clarifications needed
- Scope items (in/out of scope)

### Step 7: Handle Clarifications

If requirements have `readiness: "needs_clarification"`:

1. Present each clarification question to the user
2. Collect answers
3. Submit answers:

```bash
curl -X PUT {API_URL}/api/ideas/{id}/requirements \
  -H "Content-Type: application/json" \
  -d '{
    "clarificationAnswers": {
      "clarification-id-1": "User answer 1",
      "clarification-id-2": "User answer 2"
    }
  }'
```

4. Re-poll for refined requirements

### Step 8: Summary & Next Steps

Present a summary:

```
## Idea Created Successfully!

**Title:** [title]
**GitHub Issue:** #[number] - [url]
**Priority:** [priority]

### Research Results
[Summary of research findings]

### Implementation Plan
[Summary of plan]

### Feature Template
[Key points from template]

### Requirements Status
- Readiness: [ready_for_planning | needs_clarification | etc.]
- Clarifications: [X answered / Y total]
- Scope Items: [X confirmed / Y total]

### Next Steps
1. Review the GitHub issue: [url]
2. Address any pending clarifications
3. Confirm scope items
4. Add '{BUILD_LABEL}' label (from config) when ready for implementation
```

## API Reference

### Base URL
Development: `http://localhost:3000`
Production: Use environment-appropriate URL

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/ideas | Create new idea |
| GET | /api/ideas/{id} | Get idea details |
| PUT | /api/ideas/{id} | Update idea |
| POST | /api/ideas/{id}/research | Trigger research |
| GET | /api/ideas/{id}/research | Check research status |
| POST | /api/ideas/{id}/plan | Trigger plan |
| GET | /api/ideas/{id}/plan | Check plan status |
| GET | /api/ideas/{id}/template | Check template status |
| POST | /api/ideas/{id}/requirements | Trigger requirements |
| GET | /api/ideas/{id}/requirements | Check requirements status |
| PUT | /api/ideas/{id}/requirements | Answer clarifications |

## Idea Statuses

| Status | Meaning |
|--------|---------|
| `draft` | Initial state, not ready |
| `ready` | Ready for development |
| `in_progress` | Being implemented |
| `completed` | Implementation done |
| `archived` | No longer active |

## Job Statuses

| Status | Meaning |
|--------|---------|
| `pending` | Job queued |
| `running` | Job in progress |
| `completed` | Job finished successfully |
| `failed` | Job encountered error |

## Requirements Readiness

| Readiness | Meaning |
|-----------|---------|
| `needs_clarification` | Questions need answers |
| `needs_scope_confirmation` | Scope items need review |
| `ready_for_planning` | All clear, ready to build |
| `blocked` | Cannot proceed |

## Instructions for AI

When executing this skill:

1. **Parse arguments** - If user provides description inline, use it
2. **Gather missing details** - Ask for title, description, priority if not provided
3. **Ask about workflows** - Research and plan are optional
4. **Create the idea** - Call POST /api/ideas
5. **Monitor all triggered workflows** - Poll until complete
6. **Present results progressively** - Show each workflow result as it completes
7. **Handle clarifications** - If requirements need answers, collect them
8. **Provide actionable summary** - Link to issue, next steps

## Example Session

```
User: /idea Add dark mode support to the dashboard

AI: Great idea! Let me gather a few more details.

[AskUserQuestion]
- Priority: Medium
- Workflows: Both research and plan

AI: Creating your idea...

✅ Idea created!
- ID: idea-1704067200-abc123
- GitHub Issue: #156 (link)
- Research: Running...
- Plan: Running...
- Template: Running...

[Polls and waits]

AI: Research complete!
Key findings:
- Users prefer system-preference detection
- CSS custom properties recommended for theming
- Consider prefers-color-scheme media query

[Polls and waits]

AI: Plan complete!
Implementation approach:
1. Add ThemeProvider context
2. Create color mode toggle component
3. Update all color references to use tokens
4. Persist preference to localStorage

[Polls and waits]

AI: Template generated!
Problem: Users cannot customize visual appearance
Solution: Implement dark/light mode toggle
Success criteria: Theme persists across sessions

AI: Would you like to gather detailed requirements?

User: Yes

AI: Triggering requirements gathering...

[Polls and waits]

AI: Requirements gathered!
Readiness: needs_clarification

Clarifications needed:
1. Should we support custom themes beyond light/dark?
2. Should theme apply to embedded components?

User: 1. No, just light/dark. 2. Yes, all components.

AI: Submitting your answers...

[Polls and waits]

AI: Requirements refined!
Readiness: ready_for_planning

## Summary

**Dark mode support** - Issue #156
- Priority: Medium
- Research: ✅ Complete
- Plan: ✅ Complete
- Template: ✅ Complete
- Requirements: ✅ Ready for planning

Next steps:
1. Review issue: https://github.com/.../issues/156
2. Add '{BUILD_LABEL}' label (from config) to start implementation
```

## Error Handling

- **API errors**: Display error message, offer retry
- **Timeout**: If polling exceeds 5 minutes, warn user and offer to continue later
- **Missing issue**: If GitHub issue creation fails, show error details
- **Network issues**: Graceful degradation with retry option
