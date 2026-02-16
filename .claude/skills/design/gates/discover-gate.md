# Discover Gate Validation

Gate validation rules for the DISCOVER phase of the Double Diamond design process.

## Purpose

The Discover gate ensures sufficient divergent research has been completed before converging on a problem definition. It prevents premature commitment to solutions before understanding the problem space.

## Required Artifacts

| Artifact | File | Required |
|----------|------|----------|
| North Star | `discover/north-star.md` | ✅ |
| Market Competitors | `discover/market-competitors.md` | ✅ |
| Opportunity Backlog | `discover/opportunity-backlog.md` | ✅ |
| Research Plan | `discover/research-plan.md` | ✅ |
| Interview Guide | `discover/interview-guide.md` | ✅ |
| Empathy Maps | `discover/empathy-maps.md` | ✅ |
| Ecosystem Map | `discover/ecosystem-map.md` | ✅ |
| Feasibility Constraints | `discover/feasibility-constraints.md` | ✅ |

## Validation Checks

### Check 1: Target User Clarity
**Question**: Is the target user and their context stated without ambiguity?

**Pass criteria**:
- North star has defined target segment
- Empathy maps exist for at least 1 persona
- User context is explicit (not generic)

**Evidence required**:
- `discover/north-star.md` contains "Target Segment" section
- `discover/empathy-maps.md` has at least 1 complete persona

### Check 2: Opportunities Identified
**Question**: Are top opportunities listed with confidence labels?

**Pass criteria**:
- Opportunity backlog has 5+ items
- Each opportunity has confidence level (High/Medium/Low)
- Prioritization rationale exists

**Evidence required**:
- `discover/opportunity-backlog.md` has prioritized list with confidence labels

### Check 3: Research Plan Exists
**Question**: Is there a plan to validate assumptions?

**Pass criteria**:
- Research questions linked to assumptions
- Methods defined (interviews, surveys, etc.)
- Recruiting criteria specified

**Evidence required**:
- `discover/research-plan.md` exists with research questions

### Check 4: Constraints Documented
**Question**: Are constraints and unknowns enumerated?

**Pass criteria**:
- Hard constraints listed
- Unknown unknowns identified
- Risk register started

**Evidence required**:
- `discover/feasibility-constraints.md` has constraints section
- At least 1 spike or unknown flagged

### Check 5: Open Questions Logged
**Question**: Are unresolved questions captured for later phases?

**Pass criteria**:
- Open questions documented centrally
- Questions are specific and actionable

**Evidence required**:
- `open-questions.md` exists at design root
- Contains questions from Discover phase

## Gate Result Schema

```json
{
  "feature_id": "GH-123",
  "gate": "discover",
  "status": "COMPLETE | INCOMPLETE | BLOCKED",
  "checks": [
    {
      "id": "target_user_clarity",
      "name": "Target User Clarity",
      "passed": true,
      "evidence": ["discover/north-star.md#L10", "discover/empathy-maps.md"]
    }
  ],
  "missing_files": [],
  "failed_checks": [],
  "blocking_issues": [],
  "reloop": "none",
  "summary": "string"
}
```

## Re-loop Triggers

This gate cannot re-loop (it's the first phase). If blocked, the issue escalates to human review.

## Validation Process

1. Check all required artifacts exist
2. Run each validation check
3. Collect evidence for passing checks
4. List failing checks with remediation hints
5. Determine overall status:
   - **COMPLETE**: All 5 checks pass
   - **INCOMPLETE**: 1-2 checks fail (can proceed with awareness)
   - **BLOCKED**: 3+ checks fail or critical gaps exist
