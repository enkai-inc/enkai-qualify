# Develop Gate Validation

Gate validation rules for the DEVELOP phase of the Double Diamond design process.

## Purpose

The Develop gate ensures solutions have been explored divergently and an implementation-ready design exists. It prevents starting implementation with incomplete or untested designs.

## Required Artifacts

| Artifact | File | Required |
|----------|------|----------|
| IA Sitemap | `develop/ia-sitemap.md` | ✅ |
| Wireframes | `develop/wireframes.md` | ✅ |
| UI Spec | `develop/ui-spec.md` | ✅ |
| TDD | `develop/tdd.md` | ✅ |
| Usability Test Plan | `develop/usability-test-plan.md` | ✅ |
| Voice and Tone | `develop/voice-and-tone.md` | ✅ |
| Microcopy Inventory | `develop/microcopy-inventory.md` | ✅ |
| Gate Result | `develop/gate-result.json` | Generated |

## Validation Checks

### Check 1: UI Spec States Complete
**Question**: Does UI spec include all states with a11y notes?

**Pass criteria**:
- All 4 states defined: loading, empty, error, success
- Accessibility requirements specified (WCAG level)
- Responsive breakpoints defined
- Keyboard navigation documented

**Evidence required**:
- `develop/ui-spec.md` has States section with all 4 states
- Accessibility section exists

### Check 2: TDD Contracts Complete
**Question**: Does TDD include API contracts and data model alignment?

**Pass criteria**:
- API endpoints with request/response schemas
- Data model aligns with `define/core-data-model.md`
- Security section covers AuthN/AuthZ
- Error handling defined

**Evidence required**:
- `develop/tdd.md` has API Contracts section
- `develop/tdd.md` has Security section

### Check 3: Usability Plan Exists
**Question**: Is there a plan to validate the design with users?

**Pass criteria**:
- Test tasks defined (3+)
- Success criteria per task
- Moderation script included

**Evidence required**:
- `develop/usability-test-plan.md` has test tasks

### Check 4: Content Complete
**Question**: Is microcopy complete for all screens?

**Pass criteria**:
- All wireframe screens have microcopy entries
- All 4 states have copy variants
- No placeholder text ("Lorem ipsum")

**Evidence required**:
- `develop/microcopy-inventory.md` covers all screens

### Check 5: Implementation Ready
**Question**: Can implementation plan be derived from PRD + TDD + UI spec?

**Pass criteria**:
- Clear mapping from PRD requirements to TDD sections
- UI spec covers all user journey steps
- No unresolved spikes blocking implementation
- Acceptance criteria are implementable

**Evidence required**:
- Cross-reference PRD, TDD, UI spec for completeness

## Gate Result Schema

```json
{
  "feature_id": "GH-123",
  "gate": "develop",
  "status": "COMPLETE | INCOMPLETE | BLOCKED",
  "checks": [
    {
      "id": "ui_spec_states",
      "name": "UI Spec States Complete",
      "passed": true,
      "evidence": ["develop/ui-spec.md#L20"]
    }
  ],
  "missing_files": [],
  "failed_checks": [],
  "blocking_issues": [],
  "reloop": "none | define",
  "spikes_pending": [],
  "summary": "string"
}
```

## Re-loop Triggers

| Condition | Re-loop To | Reason |
|-----------|------------|--------|
| Usability testing invalidates problem | DEFINE | Wrong problem being solved |
| TDD requires MVP re-scope | DEFINE | Technical constraints change scope |
| Critical spike fails | DEFINE | Approach not feasible |

## Validation Process

1. Check all required artifacts exist
2. Run each validation check
3. Check for pending spikes that block implementation
4. Evaluate re-loop triggers
5. Collect evidence for passing checks
6. List failing checks with remediation hints
7. Determine overall status:
   - **COMPLETE**: All 5 checks pass, no blocking spikes
   - **INCOMPLETE**: Minor gaps, can proceed with awareness
   - **BLOCKED**: Re-loop triggered OR critical spikes pending
