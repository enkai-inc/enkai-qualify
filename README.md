# Enkai Qualify

AI-powered development toolkit built on the Pedro framework. Enkai Qualify brings intelligent automation to your software development lifecycle.

## Quick Start

```bash
# 1. Clone this repo into your project
git clone https://github.com/enkai-inc/enkai-qualify.git
cp -r enkai-qualify/.claude/ /path/to/your-repo/.claude/

# 2. Run the setup script to configure for your project
python scripts/setup_claude_config.py

# 3. Start using skills
/eval 42          # Fix issue #42
/scrum            # Process the entire issue queue
/mon              # Diagnose a pipeline failure
/deploy           # Ship it
```

## What's Inside

```
.claude/
  project.config.json     # Central config: AWS, paths, labels, secrets
  CLAUDE.md               # Behavioral rules and constraints
  settings.json           # Hook configuration
  skills/                 # 35+ skills (the brains)
  agents/                 # 9+ specialized agents (workers for orchestration skills)
  commands/               # User-facing command shortcuts
  hooks/                  # Audit trail, session management, token optimization
  observatory/            # Open-source repo scanning state and watchlists
scripts/
  setup_claude_config.py  # Interactive/auto project configurator
```

## Skills

### Development

| Skill | Command | What it does |
|-------|---------|-------------|
| **feature-dev** | `/feature-dev` | Guided feature development with spec generation, worktree isolation, and PR workflow |
| **build** | `/build` | Orchestrates scaffolder, implementer, reviewer, CI runner, and PR creator agents |
| **bug** | `/bug` | Interactive bug fixing: isolate, fix, test, PR, merge, repeat |
| **eval** | `/eval` | Process GitHub issues: claim, implement, PR, merge, auto-continue epics |
| **scrum** | `/scrum` | Parallel issue queue processor with 2 workers in isolated worktrees |
| **mcp-builder** | `/mcp-builder` | Build MCP servers: 4-phase guide (research, implement, review, evaluate) |

### Planning & Research

| Skill | Command | What it does |
|-------|---------|-------------|
| **idea** | `/idea` | 5-phase brainstorm with MoSCoW prioritization and mode selection |
| **dd** | `/dd` | Deep dive research: multi-angle analysis published as a GitHub issue |
| **design** | `/design` | 6-dimension structured research with 3 depth modes and sub-issue decomposition |
| **plan** | `/plan` | Feature evaluation, decomposition, and impact analysis with brownfield scope assessment |
| **execute** | `/execute` | Step-by-step execution of approved plans with deviation detection |
| **correct-course** | `/correct-course` | Mid-sprint course correction with impact analysis and structured proposals |
| **confidence-check** | `/confidence-check` | Pre-implementation readiness assessment across 5 dimensions |

### Quality

| Skill | Command | What it does |
|-------|---------|-------------|
| **verify** | `/verify` | Lint, type-check, test with structured JSON output for agent pipelines |
| **test** | `/test` | Run tests with coverage, generate stubs, analyze test suite health |
| **critic** | `/critic` | Fresh-context code review returning structured JSON feedback |
| **code-review** | `/code-review` | 7-dimension review framework with severity taxonomy |
| **checker** | `/checker` | Validate feature completeness, docs quality, and UAT coverage |
| **deps** | `/deps` | Security audit, outdated packages, guided upgrades |
| **ratchet** | `/ratchet` | Progressive quality thresholds that never decrease |
| **tdd-discipline** | `/tdd-discipline` | Red-green-refactor cycle enforcement with pre-commit checklist |
| **gh-triage** | `/gh-triage` | Structured issue triage with priority assessment and relationship mapping |

### Documentation

| Skill | What it does |
|-------|-------------|
| **atlas** | 5-tier documentation system with Mermaid diagrams and codebase sync |
| **marketing** | Generate marketing copy as structured markdown |

### Deployment & Operations

| Skill | Command | What it does |
|-------|---------|-------------|
| **deploy** | `/deploy` | Version, tag, push, CDK deploy, Docker build, ECS update |
| **mon** | `/mon` | Pipeline monitoring: diagnose failures, check DevOps Agent, implement fixes |
| **rollback** | `/rollback` | Emergency rollback: ECS task definition, git revert, CloudFront invalidation |
| **secrets** | `/secrets` | Upload `.env` files to AWS Secrets Manager |

### Maintenance

| Skill | Command | What it does |
|-------|---------|-------------|
| **maint** | `/maint` | 11 maintenance scanners: security, code quality, accessibility, performance, etc. |
| **clean** | `/clean` | Clean up worktrees and merged branches |
| **resolve** | `/resolve` | Resolve PR merge conflicts (defaults to all conflicting PRs) |
| **observatory** | `/observatory` | Scan open-source repos, score proposals, publish improvements as issues |

### Community & Design

| Skill | Command | What it does |
|-------|---------|-------------|
| **enkai-relay** | `/enkai-relay` | AI agent community: browse, share, discuss, vote on patterns |
| **frontend-design** | `/frontend-design` | Anti-AI-slop aesthetics guide for intentional UI work |

### Utilities

| Skill | What it does |
|-------|-------------|
| **context** | Just-in-time context loading for token-efficient operations |
| **shared/** | Common patterns (worktree lifecycle) referenced by multiple skills |

## Agents

Specialized sub-agents used by orchestration skills like **build** and **scrum**:

| Agent | Role |
|-------|------|
| **scaffolder** | Creates branch, identifies patterns and files to modify |
| **implementer** | Implements changes using TDD with iterative refinement |
| **reviewer** | Reviews code for quality, security, and pattern consistency |
| **code-reviewer** | Security-first review with project-specific rules |
| **ci-runner** | Runs quality gates with automated fix loop (max 5 iterations) |
| **pr-creator** | Pushes branch and creates structured pull requests |
| **scrum-agent** | Orchestrates parallel build workers |
| **security-reviewer** | Audits for vulnerabilities and secret exposure |
| **build-error-resolver** | Minimal-diff CI failure recovery |

## Workflows

### Idea to Production

```
/idea  -->  /design  -->  /plan  -->  /execute  -->  /deploy
capture    research     evaluate    implement     ship
```

### Issue Processing

```
/scrum (batch)  or  /eval (interactive)
  --> build --> verify --> PR --> merge
```

### Continuous Improvement (Observatory)

```
/observatory scan  -->  /observatory publish  -->  /design  -->  /execute
  poll repos           create GitHub issues     deep-dive      implement
```

### Pipeline Failure

```
/mon --> check DevOps Agent --> check auto-fixer --> diagnose --> fix --> verify
```

## Hooks

| Hook | Trigger | What it does |
|------|---------|-------------|
| **audit-trail** | PostToolUse | Tracks Write/Edit operations in a ring buffer (last 100 entries) |
| **session-manager** | PostToolUse | Persists session state: files modified, tools used, working branch |
| **compress-test-output** | PostToolUse | Strips verbose test output, keeps failures and coverage (10-30% savings) |
| **atlas-cache** | PostToolUse | Caches Feature Atlas summaries locally and in S3 (60-80% savings) |

Check token optimization stats with `python .claude/hooks/token-optimization/status.py`.

## Configuration

All skills read from `.claude/project.config.json`:

```json
{
  "project": { "name": "...", "repo_owner": "...", "repo_name": "..." },
  "paths": { "dashboard_dir": "...", "builder_dir": "...", "infra_dir": "..." },
  "github": { "labels": { "build": "...", "in_progress": "...", "needs_human": "..." } },
  "aws": { "region": "...", "stack_prefix": "...", "stacks": { ... }, "services": { ... } },
  "secrets": { "prefix": "...", "pattern": "..." },
  "worktree": { "base_dir_pattern": "../worktree-{purpose}-{id}" },
  "monitoring": { "log_groups": [], "alarms": [] },
  "token_optimization": { "cache_prefix": "...", "warn_threshold_tokens": 30000 }
}
```

Run `python scripts/setup_claude_config.py` to auto-detect and configure these values for your project, or `--non-interactive` for CI environments.

## Key Design Decisions

- **Worktree isolation** -- all implementation skills work in isolated git worktrees to prevent conflicts during parallel work
- **Config-driven** -- no hardcoded project names, AWS resources, or paths; everything reads from `project.config.json`
- **Agent composition** -- complex workflows (build, scrum) compose simpler specialized agents
- **Structured output** -- skills like verify and critic return JSON for agent-to-agent pipelines
- **AWS-native** -- ECS Fargate for compute, CodePipeline/CodeBuild for CI/CD
- **Quality ratcheting** -- thresholds only go up; `/ratchet` captures baselines and blocks regressions
- **Community-driven** -- `/observatory` scans open-source repos; `/enkai-relay` connects to the agent community for pattern sharing

## License

MIT

## Credits

Built on the [Pedro framework](https://github.com/enkai-inc/pedro).
