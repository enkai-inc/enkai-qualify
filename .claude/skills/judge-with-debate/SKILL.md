---
name: judge-with-debate
description: "Multi-round filesystem debate for high-stakes evaluations. 3 independent judges assess, debate, and converge on consensus."
---

# /judge-with-debate - Multi-Judge Debate Evaluation

You are the Debate Orchestrator. Your job is to coordinate 3 independent judges through a structured filesystem-based debate for high-stakes evaluations where single-pass review is insufficient.

## When to Use

- Security-critical changes (auth, crypto, data handling)
- Architecture decisions affecting multiple systems
- Large refactors touching core abstractions
- Pre-release validation of major features
- Activated via `--debate` flag from `/code-review`

## Invocation

```
/judge-with-debate #PR-or-description
/code-review --debate #PR-or-description
```

## Judge Identities

### Judge 1: Security Judge

**Perspective:** Adversarial threat modeling. Assumes the code will be attacked.

**Specialized Checklist:**
- Authentication and authorization boundaries
- Input validation and sanitization
- Injection vectors (SQL, NoSQL, XSS, SSRF, command injection)
- Secret management (no hardcoded credentials, proper rotation)
- Cryptographic correctness (algorithms, key sizes, randomness)
- Data exposure (logging, error messages, API responses)
- Dependency supply chain risks
- Path traversal and file access controls

### Judge 2: Architecture Judge

**Perspective:** Long-term maintainability and system evolution. Thinks in terms of change vectors.

**Specialized Checklist:**
- Separation of concerns and module boundaries
- Coupling analysis (afferent/efferent, dependency direction)
- Abstraction level consistency
- Error propagation and failure mode design
- API contract stability and backward compatibility
- Performance characteristics under load
- State management and data flow clarity
- Scalability bottlenecks and resource contention

### Judge 3: UX/DX Judge

**Perspective:** Developer experience and end-user impact. Thinks about who reads and uses this code.

**Specialized Checklist:**
- API ergonomics (naming, discoverability, pit of success)
- Error messages (actionable, specific, helpful)
- Documentation completeness and accuracy
- Test readability and coverage of real scenarios
- Configuration complexity and sensible defaults
- Migration path for existing consumers
- Accessibility impact (if UI changes)
- Onboarding friction for new contributors

## Scoring Rubric

Each judge scores every criterion on a 1-10 scale:

| Score | Meaning |
|-------|---------|
| 9-10 | Exemplary. Could be used as a reference implementation. |
| 7-8 | Good. Minor improvements possible but not blocking. |
| 5-6 | Acceptable. Has notable gaps that should be addressed. |
| 3-4 | Concerning. Significant issues that risk production problems. |
| 1-2 | Unacceptable. Fundamental problems that must be resolved. |

### Evaluation Criteria

All judges score all 5 criteria (from their own perspective):

1. **Security** - Threat surface, vulnerability exposure, defense depth
2. **Architecture** - Modularity, coupling, extensibility, failure modes
3. **Code Quality** - Readability, consistency, complexity, duplication
4. **Testing** - Coverage, edge cases, test design, confidence level
5. **UX/DX** - Ergonomics, documentation, error handling, onboarding

## Orchestration Protocol

### Phase 1: Initial Assessment (Parallel)

Dispatch 3 judge agents in parallel via Task tool. Each judge writes an independent assessment without seeing the others.

```
Task judge-1-security:
"You are the Security Judge in a multi-judge debate evaluation.

## Your Identity
You approach code from an adversarial threat-modeling perspective. Assume the code will be attacked. Your checklist:
[security checklist from above]

## Target
[description of what to evaluate - PR, files, feature]

## Instructions
1. Read all changed files independently
2. Score each of the 5 criteria (Security, Architecture, Code Quality, Testing, UX/DX) on 1-10 scale
3. Write your assessment to .specs/reports/judge-security.1.md
4. Provide evidence (file:line references) for every score below 7
5. Identify your top 3 concerns with severity labels

## Output Format
Write your assessment to .specs/reports/judge-security.1.md in this format:

# Security Judge - Round 1 Assessment

## Overall Score: X.X/10

## Criterion Scores
| Criterion | Score | Key Evidence |
|-----------|-------|-------------|
| Security | X | [brief evidence] |
| Architecture | X | [brief evidence] |
| Code Quality | X | [brief evidence] |
| Testing | X | [brief evidence] |
| UX/DX | X | [brief evidence] |

## Top Concerns
1. [SEVERITY] Description with file:line reference
2. [SEVERITY] Description with file:line reference
3. [SEVERITY] Description with file:line reference

## Detailed Analysis
[Thorough analysis from security perspective]

## Recommendations
[Specific, actionable recommendations with code examples where appropriate]
"
```

Dispatch similar tasks for `judge-2-architecture` and `judge-3-uxdx`, each writing to their respective files:
- `.specs/reports/judge-security.1.md`
- `.specs/reports/judge-architecture.1.md`
- `.specs/reports/judge-uxdx.1.md`

### Phase 2: Cross-Read and Debate (Sequential Rounds)

After all Round 1 reports are written, begin debate rounds. Each judge reads the other two judges' reports and responds.

**For each debate round N (2, 3):**

Dispatch 3 judge agents in parallel. Each reads the previous round's reports from the other two judges.

```
Task judge-1-security-round-N:
"You are the Security Judge in round N of a multi-judge debate.

## Previous Round Reports
Read these files:
- .specs/reports/judge-security.{N-1}.md (your previous assessment)
- .specs/reports/judge-architecture.{N-1}.md (Architecture Judge's assessment)
- .specs/reports/judge-uxdx.{N-1}.md (UX/DX Judge's assessment)

## Anti-Sycophancy Rule
If you change any score or position from your previous round, you MUST:
1. Cite the specific new evidence that changed your mind
2. Explain why this evidence was not considered before
3. Do NOT change positions merely because another judge disagrees

If you maintain your position despite disagreement:
1. Acknowledge the other judge's argument
2. Explain why your evidence outweighs theirs
3. Propose a specific resolution (test, mitigation, documentation)

## Instructions
1. Read all three previous-round reports
2. Identify areas of agreement and disagreement
3. Respond to specific points raised by other judges
4. Update your scores only with evidence-based justification
5. Write round N assessment to .specs/reports/judge-security.N.md

## Output Format
Write to .specs/reports/judge-security.N.md:

# Security Judge - Round N Assessment

## Score Changes
| Criterion | Previous | Current | Reason |
|-----------|----------|---------|--------|
[only rows where scores changed, or 'No changes' if none]

## Responses to Other Judges
### To Architecture Judge:
[specific responses to their points]

### To UX/DX Judge:
[specific responses to their points]

## Updated Overall Score: X.X/10

## Updated Criterion Scores
[same table format as Round 1]

## Remaining Disagreements
[list any unresolved disagreements with proposed resolutions]

## Consensus Points
[list points all judges now agree on]
"
```

### Phase 3: Consensus Detection

After each debate round, check for consensus.

**Consensus Rules:**

1. **Overall consensus:** All 3 judges' overall scores are within 0.5 points of each other
2. **Per-criterion consensus:** All 3 judges' scores for each criterion are within 1.0 point of each other
3. **No CRITICAL disagreements:** No judge has a concern labeled CRITICAL that another judge scored as acceptable (7+)

**Consensus detection algorithm:**

```
For each criterion C in [Security, Architecture, Code Quality, Testing, UX/DX]:
  scores = [judge1.C, judge2.C, judge3.C]
  if max(scores) - min(scores) > 1.0:
    consensus_reached = false
    break

overall_scores = [judge1.overall, judge2.overall, judge3.overall]
if max(overall_scores) - min(overall_scores) > 0.5:
  consensus_reached = false

For each concern labeled CRITICAL by any judge:
  if another judge scored that criterion >= 7:
    consensus_reached = false
```

**If consensus reached:** Proceed to final report.
**If not reached and rounds < 3:** Run another debate round.
**If not reached after 3 rounds:** Generate "no consensus" report for human review.

### Phase 4: Final Report

Generate the consolidated verdict.

**If consensus reached:**

Write `.specs/reports/judge-verdict.md`:

```markdown
# Judge-With-Debate Verdict

## Status: CONSENSUS REACHED (Round N)

## Final Scores (averaged across judges)
| Criterion | Security Judge | Architecture Judge | UX/DX Judge | Average |
|-----------|---------------|-------------------|-------------|---------|
| Security | X | X | X | X.X |
| Architecture | X | X | X | X.X |
| Code Quality | X | X | X | X.X |
| Testing | X | X | X | X.X |
| UX/DX | X | X | X | X.X |
| **Overall** | **X.X** | **X.X** | **X.X** | **X.X** |

## Verdict: APPROVE / REQUEST CHANGES / BLOCK

Approval thresholds:
- APPROVE: Average overall >= 7.0, no criterion below 5.0
- REQUEST CHANGES: Average overall >= 5.0, or any criterion 3.0-4.9
- BLOCK: Average overall < 5.0, or any criterion below 3.0

## Key Findings (consensus)
1. [finding agreed by all judges]
2. [finding agreed by all judges]

## Required Actions
[list of changes that must be made before approval, if any]

## Debate Summary
- Rounds used: N/3
- Initial score spread: X.X
- Final score spread: X.X
- Key points of debate: [summary]
```

**If no consensus after 3 rounds:**

Write `.specs/reports/judge-verdict.md`:

```markdown
# Judge-With-Debate Verdict

## Status: NO CONSENSUS (3 rounds exhausted)

## Final Scores (no convergence)
[same table format]

## Unresolved Disagreements
| Criterion | Judge | Score | Position |
|-----------|-------|-------|----------|
[rows showing divergent positions]

## Recommendation: ESCALATE TO HUMAN REVIEW

### For the human reviewer:
1. [specific question requiring human judgment]
2. [specific question requiring human judgment]

### Points of agreement (safe to proceed on):
1. [agreed finding]
2. [agreed finding]

### Points of contention (need human decision):
1. [disagreement summary with both sides' evidence]
2. [disagreement summary with both sides' evidence]
```

## File Output Structure

All reports are written to `.specs/reports/`:

```
.specs/reports/
  judge-security.1.md      # Security Judge, Round 1
  judge-security.2.md      # Security Judge, Round 2 (if needed)
  judge-security.3.md      # Security Judge, Round 3 (if needed)
  judge-architecture.1.md  # Architecture Judge, Round 1
  judge-architecture.2.md  # Architecture Judge, Round 2
  judge-architecture.3.md  # Architecture Judge, Round 3
  judge-uxdx.1.md          # UX/DX Judge, Round 1
  judge-uxdx.2.md          # UX/DX Judge, Round 2
  judge-uxdx.3.md          # UX/DX Judge, Round 3
  judge-verdict.md         # Final consolidated verdict
```

## Integration with /code-review

When invoked via `/code-review --debate`:

1. `/code-review` runs its standard 7-dimension review first
2. If any CRITICAL or HIGH findings exist, `/judge-with-debate` is triggered automatically
3. The code-review findings are included as context for all 3 judges
4. The debate verdict supplements (does not replace) the code-review output

## Error Handling

| Situation | Action |
|-----------|--------|
| Judge agent fails to write report | Retry once, then proceed with 2 judges |
| All judges agree on Round 1 | Skip debate rounds, go directly to verdict |
| Score parsing fails | Ask judge to re-emit scores in correct format |
| `.specs/reports/` does not exist | Create it with `mkdir -p` |

## Example Session

```
User: /judge-with-debate Evaluate the new authentication module in src/auth/

Orchestrator:
  Phase 1: Dispatches 3 parallel judge tasks
  → judge-security.1.md written (overall: 6.5)
  → judge-architecture.1.md written (overall: 7.5)
  → judge-uxdx.1.md written (overall: 8.0)

  Consensus check: spread = 1.5 > 0.5 → no consensus

  Phase 2, Round 2: Dispatches 3 parallel debate tasks
  → judge-security.2.md: maintains 6.5, cites missing CSRF protection
  → judge-architecture.2.md: adjusts to 7.0, agrees CSRF is architectural gap
  → judge-uxdx.2.md: adjusts to 7.0, agrees security concern is valid

  Consensus check: spread = 0.5 <= 0.5, per-criterion all within 1.0 → CONSENSUS

  Phase 4: Writes judge-verdict.md
  → Verdict: REQUEST CHANGES (CSRF protection needed)
```
