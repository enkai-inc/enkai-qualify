# CLAUDE.md


<IMPORTANT>
## Critical Constraints - NEVER VIOLATE

### Protected Constants
- NEVER modify `PROTECTED_CONSTANTS.md` or `dashboard/src/shared/constants/protected.ts`
- ALWAYS import from `@/shared/constants/protected` instead of hardcoding
- Includes: GitHub owner/repo, bot accounts, domain names, resource prefixes

### Autonomous Operation
- Execute `/scrum` and automated workflows WITHOUT asking for permission
- Complete workflows autonomously, report results at end

### GitHub Actions - ABSOLUTELY FORBIDDEN
- NEVER create, modify, or add GitHub Actions workflows (.github/workflows/)
- All CI/CD is handled by AWS CodeBuild/CodePipeline, not GitHub Actions
- This applies to ALL repositories including enkai-monitor

### AWS Infrastructure Preferences
- **Compute**: ALWAYS prefer ECS Fargate - no EC2, no Lambda for long-running services
- **CI/CD**: Use AWS CodePipeline + CodeBuild exclusively
- **Amplify**: NEVER use AWS Amplify - avoid at all costs
</IMPORTANT>

## Context Modes

Behavioral rules are loaded per-session based on the active context mode. This reduces token usage by ~30-40% compared to loading all rules upfront. The context loader hook (`.claude/hooks/context-loader.py`) activates the appropriate mode when a skill is invoked.

| Mode | File | Skills |
|------|------|--------|
| **dev** | `.claude/contexts/dev.md` | `/scrum`, `/build`, `/bug`, `/execute`, `/feature-dev`, `/tdd-discipline`, `/deploy`, `/mcp-builder`, `/root-cause-trace` |
| **research** | `.claude/contexts/research.md` | `/dd`, `/design`, `/idea`, `/observatory`, `/plan`, `/confidence-check` |
| **review** | `.claude/contexts/review.md` | `/code-review`, `/critic`, `/checker`, `/verify`, `/gh-triage`, `/correct-course`, `/judge-with-debate`, `/contract-review`, `/do-competitively` |

Default mode is **dev** for unrecognized skills. Context files are in `.claude/contexts/`.

## Skill Deployment Rings

Skills are organized into deployment rings to minimize baseline token consumption.
See `.claude/skill-rings.json` for the full configuration.

**Always ring** (~70KB, loaded every session): build, scrum, bug, execute, verify, plan
**Frequent ring** (~114KB, on-demand): design, dd, deploy, code-review, test, clean, resolve, confidence-check, correct-course, feature-dev, mon, checker
**Archive ring**: eval (absorbed by /scrum in unified build system v2)
**Specialized ring** (~164KB, explicit invocation only): atlas, context, critic, deps, do-competitively, frontend-design, gh-triage, idea, maint, marketing, mcp-builder, observatory, enkai-relay, ratchet, rollback, root-cause-trace, secrets, skillify, tdd-discipline

## Skill Selection Guide

| Need | Skill | Ring | ~KB | When |
|------|-------|------|-----|------|
| Quick bug fix | `/bug` | always | 7 | Single bug, fix-commit-PR-merge loop |
| Agent pipeline | `/build` | always | 9 | Scaffolder, implementer, reviewer, CI, PR |
| Issue processing | `/scrum` | always | 15 | 6 parallel Codex builders, Work Unit decomposition, epic continuation |
| Execute plan | `/execute` | always | 9 | Step-by-step execution with deviation detection |
| Quality gates | `/verify` | always | 9 | Lint, type-check, test with structured results |
| Planning | `/plan` | always | 22 | Evaluate, decompose, impact analysis via Feature Atlas |
| Design research | `/design` | frequent | 25 | Double Diamond with 9 agents, 30+ artifacts, gate validation |
| Quick research | `/dd` | frequent | 4 | Deep dive, publishes structured GitHub issue |
| Deployment | `/deploy` | frequent | 11 | Version, tag, push, CDK, Docker, ECS |
| Code review | `/code-review` | frequent | 4 | 7-dimension review with severity taxonomy |
| Run tests | `/test` | frequent | 3 | Coverage analysis, identify untested code |
| Clean branches | `/clean` | frequent | 6 | Remove worktrees and merged branches |
| Merge conflicts | `/resolve` | frequent | 9 | Resolve PR conflicts, rebase failures |
| Readiness check | `/confidence-check` | frequent | 5 | 5-dimension assessment before /build or /design |
| Course correction | `/correct-course` | frequent | 15 | Mid-sprint plan changes with impact analysis |
| Feature spec | `/feature-dev` | frequent | 15 | Guided feature development with architecture focus |
| Pipeline monitor | `/mon` | frequent | 13 | Diagnose AWS pipeline failures, fix and PR |
| Feature validation | `/checker` | frequent | 11 | Completeness, docs quality, UAT coverage |
| Idea capture | `/idea` | specialized | 12 | Brainstorm, research, plan, template pipeline |
| Documentation | `/atlas` | specialized | 22 | Feature atlas, architecture docs, diagrams |
| Open-source monitor | `/observatory` | specialized | 27 | Scan repos for improvements, propose adaptations |
| MCP servers | `/mcp-builder` | specialized | 4 | 4-phase guide: research, implement, review, evaluate |
| TDD workflow | `/tdd-discipline` | specialized | 3 | Red-green-refactor cycle, pre-commit checklist |
| Issue triage | `/gh-triage` | specialized | 4 | Priority assessment, relationship mapping |
| Frontend design | `/frontend-design` | specialized | 3 | Anti-AI-slop aesthetics guide for UI |
| Maintenance | `/maint` | specialized | 9 | Automated scans, issue creation, fix PRs |
| Dependencies | `/deps` | specialized | 3 | Security audit, outdated packages |
| Rollback | `/rollback` | specialized | 4 | Git revert, ECS rollback, CloudFront invalidation |
| Secrets | `/secrets` | specialized | 6 | Upload .env to AWS Secrets Manager |
| Skill capture | `/skillify` | specialized | 10 | Capture session processes as reusable SKILL.md via 4-round interview |
| Marketing | `/marketing` | specialized | 6 | Landing pages, feature showcases, promo copy |
| Deliberation | `/enkai-relay` | specialized | 23 | AI agent deliberation platform |
| Context loading | `/context` | specialized | 7 | JIT context loading for token efficiency |
| Code critic | `/critic` | specialized | 6 | Adversarial bias-aware review (Reflexion Reflect), structured JSON feedback |
| Quality ratchet | `/ratchet` | specialized | 3 | Progressive thresholds that never decrease |
| Multi-judge debate | `/judge-with-debate` | specialized | 8 | High-stakes evaluation with 3 independent judges |
| Root cause trace | `/root-cause-trace` | specialized | 5 | 5-step backward trace debugging methodology |
| Contract review | `/contract-review` | specialized | 8 | Type design, contract stability, encapsulation quality |
| Competitive GCS | `/do-competitively` | specialized | 16 | 3 generators + 3 judges + adaptive synthesis for critical decisions |

### Fresh Context Per Agent

Skills that orchestrate sub-agents (scrum, build, design) use **minimal context profiles** — each sub-agent starts with clean context specific to its task, not the full CLAUDE.md + all skills. See individual skill files for per-agent context definitions:
- `/scrum` — scrum master vs. Codex builder profiles (`scrum/SKILL.md`)
- `/build` — scaffolder, implementer, reviewer, CI runner profiles (`build/SKILL.md`)
- `/design` — 9 specialized design agents (`design/SKILL.md`)

### Unified Build System (v2)

**Human-driven research and design. Machine-driven execution.**

```
RESEARCH → DESIGN (Double Diamond) → PLAN → BUILD (6x Codex Builders)
```

| Phase | Skill | Agents | Output |
|-------|-------|--------|--------|
| **RESEARCH** | `/idea` or manual | Human + Claude | GitHub issue + research report |
| **DESIGN** | `/design` | 9 specialized | 30+ artifacts in `docs/design/${FEATURE_ID}/` |
| **PLAN** | `/plan` | Planner | Epic + feature specs |
| **BUILD** | `/scrum` | Scrum Master + 6 Codex | Work Units → PRs |

### Idea-to-Production Pipeline

`/idea` → `/design` → `/plan` → `/scrum`

1. **Idea**: Capture and initial research
2. **Design**: Double Diamond (Discover → Define → Develop → Deliver) with 9 specialized agents
3. **Plan**: Decompose into epics and feature specs
4. **Build**: Scrum Master decomposes to Codex-simple Work Units, 6 builders execute in parallel

### Continuous Improvement Pipeline

`/observatory scan` → `/observatory publish` → `/design` → `/plan` → `/execute`

1. **Scan**: Poll watched repos for changes, download and analyze with scoring subagent
2. **Publish**: Create GitHub issues from high-priority findings (score >= 7), batch digests (4-6)
3. **Design**: Deep-dive high-value proposals through 6-dimension research
4. **Plan**: Evaluate adoption complexity, plan integration
5. **Execute**: Implement the approved adaptations

Run `/observatory scan` daily (or via heartbeat). Run `/observatory report` to check status.

### FPF Trust Calculus

The First Principles Framework (FPF) provides evidence-based reliability scoring for decisions. The FPF agent (`.claude/agents/fpf-agent.md`) is integrated into `/plan` and `/design` skills:

- **R_eff scoring**: Quantifies decision reliability as `R_eff = Self_Score x min(Evidence_R) x Product(Dependency_R) x Congruence_Factor`
- **Hypothesis lifecycle**: Tracks assumptions from L0 (abductive guess) through L1 (logically verified) to L2 (empirically validated)
- **Weakest link identification**: Every recommendation chain explicitly names its least reliable evidence
- **Audit trail**: State written to `.fpf/` directory for traceability
