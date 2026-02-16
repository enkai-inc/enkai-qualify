# Deliver Gate Validation

Gate validation rules for the DELIVER phase of the Double Diamond design process.

## Purpose

The Deliver gate ensures the feature is ready for release. It validates that implementation meets requirements, tests pass, and launch materials are complete.

## Required Artifacts

| Artifact | File | Required |
|----------|------|----------|
| Test Plan | `deliver/test-plan.md` | ✅ |
| Release Notes | `deliver/release-notes.md` | ✅ |
| Launch Plan | `deliver/launch-plan.md` | ✅ |
| Sales/Support Enablement | `deliver/sales-support-enablement.md` | ✅ |
| Gate Result | `deliver/gate-result.json` | Generated |

## Validation Checks

### Check 1: Acceptance Criteria Met
**Question**: Are all PRD acceptance criteria implemented or explicitly deferred?

**Pass criteria**:
- Each PRD requirement checked against implementation
- All critical requirements implemented
- Deferred items documented with justification

**Evidence required**:
- Cross-reference `define/prd.md` requirements against implementation
- Deferred items list (if any)

### Check 2: Tests Pass
**Question**: Do all tests pass?

**Pass criteria**:
- Unit tests pass
- Integration tests pass (if applicable)
- Type checking passes
- Lint passes

**Evidence required**:
- Test execution results
- CI pipeline green

### Check 3: QA Sign-off
**Question**: Has QA signed off on quality?

**Pass criteria**:
- Test plan executed
- No critical or major bugs open
- QA engineer approved

**Evidence required**:
- QA sign-off in test plan or separate document

### Check 4: Documentation Complete
**Question**: Are release notes and docs complete?

**Pass criteria**:
- Release notes cover all changes
- Known issues documented
- Migration notes included (if applicable)
- Enablement materials complete

**Evidence required**:
- `deliver/release-notes.md` complete
- `deliver/sales-support-enablement.md` has FAQ

### Check 5: Instrumentation Ready
**Question**: Is success metrics instrumentation in place?

**Pass criteria**:
- KPIs from `define/success-metrics.md` can be measured
- Tracking code implemented
- Dashboards ready (or plan exists)

**Evidence required**:
- Analytics/tracking implementation verified

### Check 6: Rollback Plan Exists
**Question**: Is there a plan if things go wrong?

**Pass criteria**:
- Rollback procedure documented
- Rollback triggers defined
- Tested (or test plan exists)

**Evidence required**:
- `deliver/launch-plan.md` has Rollback section

## Gate Result Schema

```json
{
  "feature_id": "GH-123",
  "gate": "deliver",
  "status": "COMPLETE | INCOMPLETE | BLOCKED",
  "checks": [
    {
      "id": "acceptance_criteria_met",
      "name": "Acceptance Criteria Met",
      "passed": true,
      "evidence": ["Implementation verified against PRD"]
    }
  ],
  "missing_files": [],
  "failed_checks": [],
  "blocking_issues": [],
  "deferred_items": [],
  "critical_bugs": 0,
  "major_bugs": 0,
  "reloop": "none | develop | define",
  "summary": "string"
}
```

## Re-loop Triggers

| Condition | Re-loop To | Reason |
|-----------|------------|--------|
| Severe usability issues | DEVELOP | Design needs rework |
| Systemic QA failures | DEVELOP | Implementation approach wrong |
| Requirements change | DEFINE | Core value prop no longer holds |
| Security vulnerability found | DEVELOP | Architecture needs fixing |

## Validation Process

1. Check all required artifacts exist
2. Verify implementation against PRD
3. Check test results and QA status
4. Validate documentation completeness
5. Verify instrumentation
6. Check rollback plan
7. Evaluate re-loop triggers
8. Determine overall status:
   - **COMPLETE**: All 6 checks pass, ready to ship
   - **INCOMPLETE**: Minor gaps, can ship with known issues
   - **BLOCKED**: Critical failures OR re-loop triggered

## Release Decision

| Gate Status | Release Decision |
|-------------|------------------|
| COMPLETE | ✅ Ship it |
| INCOMPLETE | ⚠️ Ship with awareness, track known issues |
| BLOCKED | 🛑 Do not ship, resolve blockers first |
