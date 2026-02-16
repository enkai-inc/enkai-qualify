---
name: skillify
description: "Capture session processes as reusable SKILL.md files via 4-round interview."
---

# Skillify Skill

An interactive agent that captures repeatable session processes as reusable SKILL.md files. Analyzes the current session's workflow and guides the user through a structured 4-round interview to extract the skill definition.

## When to Use This Skill

- "Turn this session into a skill"
- "Skillify this workflow"
- "Capture this process"
- "Create a skill from what we just did"
- When the user wants to automate a repeatable workflow they've just performed

## Workflow Overview

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 1/5: ANALYZE SESSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 2/5: ROUND 1 — HIGH-LEVEL CONFIRMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 3/5: ROUND 2 — DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 4/5: ROUND 3 — PER-STEP BREAKDOWN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Phase 5/5: ROUND 4 — FINAL QUESTIONS & WRITE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Workflow Steps

### Step 1: Analyze the Session

Before asking any questions, analyze the current session to identify:

1. **Process identification** — What repeatable process was performed?
2. **Inputs/parameters** — What were the inputs to this process?
3. **Steps** — What were the distinct steps (in order)?
4. **Success criteria** — What proves each step succeeded? (e.g., "open PR with CI passing", not just "wrote code")
5. **User corrections** — Where did the user steer or correct the process?
6. **Tools used** — What tools and permissions were needed?
7. **Agents used** — Were any subagents or Task tools invoked?
8. **Goals** — What were the final goals and artifacts?

**Important**: Pay special attention to user corrections during the session — these reveal hard constraints and preferences that must be captured in the skill.

### Step 2: Round 1 — High-Level Confirmation

Use `AskUserQuestion` for ALL questions. Never ask via plain text.

Present your analysis and ask the user to confirm or adjust:

| Question | Purpose |
|----------|---------|
| **Skill name** | Suggest a name based on analysis, ask user to confirm or rename |
| **Description** | One-line description of what the skill does |
| **Goal(s)** | High-level goals for the skill |
| **Success criteria** | What proves the entire skill completed successfully? |

Example AskUserQuestion:
```
Question: Based on this session, I suggest naming this skill "deploy-to-staging". Is this name correct?

Options:
1. Yes, use "deploy-to-staging"
2. Use a different name (I'll type it)
```

Iterate until the user is happy with the high-level definition.

### Step 3: Round 2 — Details

Present the steps you identified and gather more details:

| Question | Purpose |
|----------|---------|
| **Steps review** | Present numbered list of steps, ask for confirmation |
| **Arguments** | Suggest arguments based on what you observed |
| **Context mode** | Should this run inline or forked? |
| **Save location** | Where should the skill be saved? |

**Context modes:**
- **inline** (default) — Runs in current conversation, user can steer mid-process
- **fork** — Runs as sub-agent with own context, better for self-contained tasks

**Save locations:**
- **This repo** (`.claude/skills/<name>/SKILL.md`) — For repo-specific workflows
- **Personal** (`~/.claude/skills/<name>/SKILL.md`) — Follows you across all repos

Example AskUserQuestion:
```
Question: Where should this skill be saved?

Options:
1. This repo (.claude/skills/deploy-to-staging/SKILL.md) (Recommended)
2. Personal (~/.claude/skills/deploy-to-staging/SKILL.md)
```

### Step 4: Round 3 — Per-Step Breakdown

For each major step, if not glaringly obvious, ask:

| Question | Purpose |
|----------|---------|
| **Artifacts** | What does this step produce that later steps need? |
| **Success criteria** | What proves this step succeeded? |
| **Human checkpoint** | Should user confirm before proceeding? |
| **Parallelization** | Can this run concurrently with other steps? |
| **Execution mode** | Direct, Task agent, Teammate, or [human]? |
| **Hard constraints** | What must or must not happen? |

**Important**: Do multiple rounds of AskUserQuestion here — one round per step if there are more than 3 steps or many clarifications needed.

**Execution modes:**
- **Direct** (default) — Execute directly in current context
- **Task agent** — Delegate to subagent for straightforward tasks
- **Teammate** — Agent with parallelism and inter-agent communication
- **[human]** — User performs this step manually

### Step 5: Round 4 — Final Questions & Write

Confirm when the skill should be invoked:

| Question | Purpose |
|----------|---------|
| **Trigger conditions** | When should this skill be invoked? |
| **Trigger phrases** | Example user messages that should trigger this skill |
| **Gotchas** | Any edge cases or things to watch out for? |

**Stop interviewing once you have enough information. Don't over-ask for simple processes!**

### Step 6: Write the SKILL.md

Create the skill file using this template:

```markdown
---
name: {{skill-name}}
description: "{{one-line description}}"
allowed-tools:
  {{list of tool permission patterns observed during session}}
when_to_use: "{{detailed trigger description with example phrases}}"
argument-hint: "{{hint showing argument placeholders}}"
arguments:
  {{list of argument names}}
context: {{fork — only if not inline}}
---

# {{Skill Title}}

Description of what the skill does.

## When to Use This Skill

- "{{trigger phrase 1}}"
- "{{trigger phrase 2}}"
- When {{condition}}

## Inputs

- `$arg_name`: Description of this input

## Goal

Clearly stated goal for this workflow. Include specific artifacts or criteria for completion.

## Steps

### 1. Step Name

What to do in this step. Be specific and actionable. Include commands when appropriate.

**Success criteria**: {{what proves this step is done}}

**Artifacts**: {{data produced for later steps, if any}}

**Human checkpoint**: {{when to pause for confirmation, if needed}}

**Rules**: {{hard constraints from user corrections}}

### 2. Step Name

...

## Error Handling

- **Condition**: How to handle
- **Condition**: How to handle
```

### Step 7: Preview and Confirm

Before writing the file:

1. Output the complete SKILL.md content as a YAML code block for user review
2. Use `AskUserQuestion` to confirm:
   ```
   Question: Does this SKILL.md look good to save?

   Options:
   1. Yes, save it
   2. Make changes (I'll describe them)
   ```

3. After confirmation, write the file to the chosen location

### Step 8: Summary

After saving, tell the user:

```
## Skill Created Successfully!

**Name:** {{skill-name}}
**Location:** {{path/to/SKILL.md}}

### How to Invoke

/{{skill-name}} {{arguments}}

### Trigger Phrases

- "{{phrase 1}}"
- "{{phrase 2}}"

### Next Steps

1. Try invoking the skill: `/{{skill-name}}`
2. Edit the SKILL.md directly to refine it
3. Add to skill-rings.json if you want it loaded automatically
```

## SKILL.md Frontmatter Reference

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Skill identifier (lowercase, hyphenated) |
| `description` | Yes | One-line description (quoted) |
| `allowed-tools` | No | Tool permission patterns (e.g., `Bash(gh:*)`, `Read`) |
| `when_to_use` | No | Trigger description with example phrases |
| `argument-hint` | No | Placeholder hint (e.g., `"{{branch}} [--force]"`) |
| `arguments` | No | List of argument names |
| `context` | No | `fork` for sub-agent execution; omit for inline |

## Per-Step Annotation Reference

| Annotation | Required | Description |
|------------|----------|-------------|
| **Success criteria** | Yes | What proves this step is done |
| **Execution** | No | `Direct`, `Task agent`, `Teammate`, or `[human]` |
| **Artifacts** | No | Data produced for later steps |
| **Human checkpoint** | No | When to pause for user confirmation |
| **Rules** | No | Hard constraints from user corrections |

## Step Structure Tips

- Steps that can run concurrently use sub-numbers: `3a`, `3b`
- Steps requiring user action get `[human]` in the title
- Keep simple skills simple — a 2-step skill doesn't need annotations on every step
- Always include success criteria — it's the most important annotation

## Instructions for AI

When executing this skill:

1. **Analyze first** — Before asking any questions, thoroughly analyze the session
2. **Use AskUserQuestion** — Never ask questions via plain text
3. **Don't over-ask** — Simple processes need fewer questions
4. **Capture corrections** — User steering during session reveals hard constraints
5. **Preview before save** — Always show the SKILL.md for review
6. **Iterate** — Allow multiple rounds per interview phase if needed
7. **Default inline** — Only use `context: fork` for truly self-contained tasks

## Example Session

```
User: /skillify

AI: I'll analyze this session to capture it as a reusable skill.

## Session Analysis

Based on this session, I identified:
- **Process**: Deploy feature branch to staging environment
- **Steps**: 1) Run tests, 2) Build Docker image, 3) Push to ECR, 4) Update ECS service
- **Tools used**: Bash, Read, Edit
- **User corrections**: You preferred `--no-cache` on Docker builds

Let me confirm the details...

[AskUserQuestion: Skill name?]

User: Yes, "deploy-staging" works

AI: [AskUserQuestion: Context mode?]

User: Inline, I want to steer if tests fail

AI: [AskUserQuestion: Per-step details...]

...

AI: Here's the generated SKILL.md:

```yaml
---
name: deploy-staging
description: "Deploy feature branch to staging environment."
allowed-tools:
  - Bash(docker:*)
  - Bash(aws:*)
when_to_use: "Use when the user wants to deploy to staging. Examples: 'deploy to staging', 'push to staging', 'staging deploy'"
---
...
```

[AskUserQuestion: Save this?]

User: Yes

AI: Skill saved to .claude/skills/deploy-staging/SKILL.md

Invoke with: /deploy-staging
```

## Error Handling

- **Empty session**: If no significant process was performed, inform user and suggest what to do first
- **Ambiguous process**: Ask clarifying questions in Round 1 to narrow down
- **Write failure**: Report error, suggest alternative location
- **User cancels**: Acknowledge and offer to resume later
