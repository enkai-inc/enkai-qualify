# Define Gate Validation

Gate validation rules for the DEFINE phase of the Double Diamond design process.

## Purpose

The Define gate ensures the problem has been properly scoped and stakeholders have approved the direction before exploring solutions. It prevents building the wrong thing by validating problem definition.

## Required Artifacts

| Artifact | File | Required |
|----------|------|----------|
| Problem Statement | `define/problem-statement.md` | ✅ |
| PRD | `define/prd.md` | ✅ |
| MVP Scope | `define/mvp-scope.md` | ✅ |
| Success Metrics | `define/success-metrics.md` | ✅ |
| User Journeys | `define/user-journeys.md` | ✅ |
| Architecture Sketch | `define/architecture-sketch.md` | ✅ |
| Core Data Model | `define/core-data-model.md` | ✅ |
| Stakeholder Review | `define/stakeholder-review.md` | ✅ |
| Gate Result | `define/gate-result.json` | Generated |

## Validation Checks

### Check 1: Problem Statement Quality
**Question**: Is the problem statement single-sentence clear and testable?

**Pass criteria**:
- Problem statement is a single sentence
- Follows format: "For [user], who [context], we will [solution] so that [outcome]"
- Outcome is testable/measurable

**Evidence required**:
- `define/problem-statement.md` has properly formatted statement

### Check 2: MVP Scope Explicit
**Question**: Is MVP scope explicit with in/out and non-goals?

**Pass criteria**:
- In-scope items listed
- Out-of-scope items listed
- Non-goals explicitly stated
- Success criteria for MVP defined

**Evidence required**:
- `define/mvp-scope.md` has all 4 sections

### Check 3: PRD Acceptance Criteria
**Question**: Does PRD have acceptance criteria per requirement?

**Pass criteria**:
- 5+ requirements listed
- Each requirement has acceptance criteria
- Criteria are testable

**Evidence required**:
- `define/prd.md` has requirements with "Acceptance Criteria" subsections

### Check 4: Metrics Measurable
**Question**: Are success metrics measurable with methodology?

**Pass criteria**:
- KPIs tied to north star
- Measurement methodology defined
- Baselines established or planned

**Evidence required**:
- `define/success-metrics.md` has KPIs with measurement plan

### Check 5: Architecture Plausible
**Question**: Is the architecture sketch technically feasible?

**Pass criteria**:
- Components identified
- Data flow documented
- External dependencies listed
- No obvious technical blockers

**Evidence required**:
- `define/architecture-sketch.md` has component diagram
- `define/core-data-model.md` has entity definitions

### Check 6: Stakeholder Approval
**Question**: Have stakeholders approved the direction?

**Pass criteria**:
- Stakeholder review completed
- Status is APPROVED or CONDITIONAL
- No unresolved critical issues

**Evidence required**:
- `define/stakeholder-review.md` exists with verdict

## Gate Result Schema

```json
{
  "feature_id": "GH-123",
  "gate": "define",
  "status": "COMPLETE | INCOMPLETE | BLOCKED",
  "checks": [
    {
      "id": "problem_statement_quality",
      "name": "Problem Statement Quality",
      "passed": true,
      "evidence": ["define/problem-statement.md#L5"]
    }
  ],
  "missing_files": [],
  "failed_checks": [],
  "blocking_issues": [],
  "reloop": "none | discover",
  "summary": "string"
}
```

## Re-loop Triggers

| Condition | Re-loop To | Reason |
|-----------|------------|--------|
| Conflicting ICP assumptions | DISCOVER | User understanding incomplete |
| No evidence path for problem | DISCOVER | Research gaps |
| Architecture infeasible | DISCOVER | Technical constraints unknown |

## Validation Process

1. Check all required artifacts exist
2. Run each validation check
3. Evaluate re-loop triggers
4. Collect evidence for passing checks
5. List failing checks with remediation hints
6. Determine overall status:
   - **COMPLETE**: All 6 checks pass, stakeholder approved
   - **INCOMPLETE**: Minor gaps, stakeholder conditional approval
   - **BLOCKED**: Stakeholder blocked OR re-loop triggered
