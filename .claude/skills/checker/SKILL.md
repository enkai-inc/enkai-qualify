---
name: checker
description: "Validate feature completeness, docs quality, redundancy, and UAT coverage."
---

# Feature Checker Skill

A comprehensive feature validation tool that checks for completeness, documentation quality, redundancy, and UAT test coverage, with interactive fix capabilities.

**Configuration**: Read `.claude/project.config.json` for:
- Atlas features path: `paths.atlas_features_dir` or `paths.atlas_dir` + `/features`
- UAT test path: `paths.test_uat_dir`

## When to Use This Skill

- "Check feature X"
- "Validate the dashboard feature"
- "Is this feature complete?"
- "Check documentation for feature Y"
- "Find redundant documentation"
- "Are there UAT tests for feature Z?"
- When you want to validate a feature meets quality standards

## Check Categories

| Category | Description |
|----------|-------------|
| Completeness | Requirements implemented, acceptance criteria met |
| Documentation | Feature atlas and product docs are complete |
| Redundancy | Identify semantically duplicate documentation |
| UAT Coverage | Acceptance criteria have corresponding tests |

## Workflow Steps

### Step 1: List Available Features

Read the feature atlas directory (from config) to get available features:

```bash
# Read features path from config: paths.atlas_features_dir
ls {FEATURES_DIR}/*.md | xargs -I{} basename {} .md
```

Present the features to the user using AskUserQuestion:

```
Question: Which feature would you like to check?

Options:
1. dashboard - Dashboard feature
2. notifications - Notification system
3. pipelines - Pipeline management
4. ... (list all available features)
```

### Step 2: Load Feature Atlas

Read the selected feature's atlas document (use path from config):

```bash
cat {FEATURES_DIR}/FEATURE_NAME.md
```

Parse the YAML frontmatter to extract:
- `name` - Feature name
- `description` - Feature description
- `requirements` - List of requirements
- `acceptance_criteria` - List of acceptance criteria
- `status` - Current status
- `technical_design` - Technical implementation details

### Step 3: Completeness Check

Analyze the feature for completeness:

1. **Requirements Coverage**
   - For each requirement in the atlas, search the codebase to verify implementation
   - Use Grep to find related code patterns
   - Mark requirements as: Implemented, Partial, or Missing

2. **Acceptance Criteria Verification**
   - Check each criterion is specific and testable
   - Verify criteria have corresponding implementations
   - Flag vague or incomplete criteria

3. **Status Accuracy**
   - Verify the `status` field matches actual implementation state
   - Check if status should be updated based on findings

Output format:
```
### Completeness Check

**Requirements:**
- [x] REQ-1: User authentication - Implemented in `auth/login.ts`
- [ ] REQ-2: Password reset - Missing implementation
- [~] REQ-3: Session management - Partial (missing timeout handling)

**Acceptance Criteria:**
- [x] AC-1: User can log in with email/password
- [ ] AC-2: User receives email on password reset

**Status:** Documented as "complete", should be "in_progress"
```

### Step 4: Documentation Completeness Check

Check documentation in two locations:

#### Feature Atlas (`{FEATURES_DIR}/FEATURE_NAME.md`)
Required sections:
- [ ] Has meaningful description
- [ ] Has requirements list
- [ ] Has acceptance_criteria list
- [ ] Has technical_design section
- [ ] Has status field

#### Product Documentation (`docs/`)
Search for feature mentions:

```bash
# Find docs mentioning the feature
grep -r "FEATURE_NAME" docs/*.md docs/**/*.md
```

Check:
- [ ] Feature mentioned in relevant architecture docs
- [ ] API endpoints documented (if applicable)
- [ ] Configuration options documented (if applicable)
- [ ] User-facing documentation exists (if user-visible feature)

Output format:
```
### Documentation Check

**Feature Atlas:**
- [x] Description: Present
- [x] Requirements: 5 items listed
- [x] Acceptance criteria: 8 items listed
- [ ] Technical design: Missing
- [x] Status: Present

**Product Docs:**
- [x] Mentioned in: docs/02_ARCHITECTURE.md, docs/03_API.md
- [ ] API docs: Missing endpoint documentation for /api/feature
- [x] Config docs: Present in docs/05_CONFIGURATION.md
```

### Step 5: Documentation Redundancy Check (Semantic)

Use LLM-based semantic analysis to find duplicate content:

1. **Extract Documentation Segments**
   - Read feature atlas content
   - Read related product documentation
   - Split into logical paragraphs/sections

2. **Semantic Comparison**
   For each pair of documentation segments:
   - Compare meaning, not just exact text
   - Identify: Same concept explained twice, copy-pasted content, outdated duplicates

3. **Flag Redundancy Types**
   - **Exact Duplicate**: Same text in multiple places
   - **Semantic Duplicate**: Same concept, different words
   - **Outdated Duplicate**: One version is stale

Output format:
```
### Redundancy Check

**Found 2 potentially redundant sections:**

1. **Semantic Duplicate**
   - Location A: docs/atlas/features/dashboard.md (lines 15-20)
   - Location B: docs/02_ARCHITECTURE.md (lines 145-152)
   - Content: Both describe the dashboard data flow
   - Recommendation: Keep in architecture doc, reference from atlas

2. **Exact Duplicate**
   - Location A: docs/atlas/features/dashboard.md (lines 45-50)
   - Location B: docs/03_API.md (lines 80-85)
   - Content: API response schema copied verbatim
   - Recommendation: Define schema once in API doc, reference elsewhere
```

### Step 6: UAT Test Coverage Check

Analyze UAT tests (path from config: `paths.test_uat_dir`):

1. **Find Related Test Files**
   ```bash
   find {TEST_UAT_DIR} -name "*.ts" | xargs grep -l "FEATURE_NAME"
   ```

2. **Parse Test Definitions**
   Look for `UATTestDefinition` objects:
   - `testId` - Test identifier
   - `name` - Test name
   - `description` - What it tests
   - `steps` - Array of `UATTestStep`
   - `acceptanceCriteriaId` - Link to acceptance criteria

3. **Map Tests to Acceptance Criteria**
   For each acceptance criterion:
   - Find tests with matching `acceptanceCriteriaId`
   - Check test steps are meaningful
   - Flag criteria without tests

4. **Check Test Quality**
   - Has meaningful assertions
   - Covers happy path
   - Covers error cases (if applicable)

Output format:
```
### UAT Coverage Check

**Acceptance Criteria Coverage: 6/8 (75%)**

- [x] AC-1: "User can log in" → `login.uat.ts:test-login-001`
- [x] AC-2: "User sees dashboard" → `dashboard.uat.ts:test-dashboard-001`
- [ ] AC-3: "User can export data" → No test found
- [ ] AC-4: "Error handling" → No test found

**Test Quality Issues:**
- `dashboard.uat.ts:test-dashboard-002` - Missing error case assertions
- `login.uat.ts:test-login-003` - Steps lack descriptions
```

### Step 7: Generate Summary Report

Compile all checks into a summary:

```
## Feature Check Report: FEATURE_NAME

### Overall Score: 7/10

| Category | Status | Score |
|----------|--------|-------|
| Completeness | Partial | 3/4 |
| Documentation | Incomplete | 2/3 |
| Redundancy | 2 issues | -1 |
| UAT Coverage | 75% | 3/4 |

### Summary
- 1 requirement missing implementation
- Technical design section missing from atlas
- 2 documentation redundancies found
- 2 acceptance criteria lack UAT tests

### Priority Fixes
1. Implement REQ-2: Password reset
2. Add technical design to feature atlas
3. Write UAT tests for AC-3 and AC-4
```

### Step 8: Interactive Fix Mode

After showing the report, offer to fix issues:

```
Question: Would you like me to help fix any issues?

Options:
1. Fix documentation gaps - Generate missing documentation
2. Fix redundancy - Consolidate duplicate content
3. Generate UAT tests - Create missing test definitions
4. Fix all - Address all issues
5. Skip - Just show the report
```

#### For Documentation Fixes
- Generate missing sections based on codebase analysis
- Fill in technical design from implementation
- Update status field based on findings

#### For Redundancy Fixes
- Identify which location should be authoritative
- Replace duplicate with reference
- Ensure cross-references are valid

#### For UAT Test Generation
- Generate `UATTestDefinition` for missing criteria
- Create meaningful test steps
- Add proper descriptions and assertions

Apply fixes with user confirmation before each change.

## Important Notes

### Semantic Analysis
The redundancy check uses Claude to compare meaning:
- Look for conceptual overlap, not just text matching
- Consider context when flagging duplicates
- Some duplication is acceptable for clarity

### UAT Test Structure
Tests follow the pattern in `{TEST_UAT_DIR}/types.ts`:
```typescript
interface UATTestDefinition {
  testId: string;
  name: string;
  description: string;
  acceptanceCriteriaId?: string;
  steps: UATTestStep[];
  expectedResult: string;
}
```

### Feature Atlas Structure
Features follow the pattern in the features directory (from config):
```yaml
---
name: feature-name
description: Brief description
status: complete | in_progress | planned
requirements:
  - REQ-1: Description
acceptance_criteria:
  - AC-1: Description
technical_design:
  architecture: Description
  components: List
---
```

## Instructions for AI

When executing this skill:

1. **Single feature at a time** - Always work on one feature per invocation
2. **Use AskUserQuestion for selection** - Let user choose which feature to check
3. **Be thorough but focused** - Check all categories but don't over-flag
4. **Semantic analysis for redundancy** - Compare meaning, not just text
5. **Map tests to acceptance criteria** - Use acceptanceCriteriaId when available
6. **Generate actionable report** - Prioritize fixes by impact
7. **Interactive fix mode** - Offer to generate fixes after report
8. **Confirm before changes** - Always get user approval before modifying files
9. **Reference existing patterns** - Use existing code/docs as templates
10. **Track progress** - Update user on each check category

## Example Session

```
User: /checker

AI: Let me find available features to check.
[Lists features from docs/atlas/features/]

AI: Which feature would you like to check?
1. dashboard
2. notifications
3. pipelines
4. ai-chat

User: notifications

AI: Checking the notifications feature...

### Running Completeness Check...
[Analyzes requirements and acceptance criteria]

### Running Documentation Check...
[Checks feature atlas and product docs]

### Running Redundancy Check...
[Semantic analysis of documentation]

### Running UAT Coverage Check...
[Maps tests to acceptance criteria]

AI: ## Feature Check Report: notifications

### Overall Score: 6/10

| Category | Status | Score |
|----------|--------|-------|
| Completeness | Complete | 4/4 |
| Documentation | Incomplete | 1/3 |
| Redundancy | 1 issue | -1 |
| UAT Coverage | 50% | 2/4 |

### Priority Fixes
1. Add technical_design section to atlas
2. Write UAT tests for AC-3, AC-4, AC-5, AC-6
3. Consolidate duplicate notification flow description

AI: Would you like me to help fix any issues?
1. Fix documentation gaps
2. Fix redundancy
3. Generate UAT tests
4. Fix all
5. Skip

User: Generate UAT tests

AI: I'll generate UAT test definitions for the missing acceptance criteria.
[Generates test definitions]
[Shows preview of generated tests]

AI: Would you like me to add these tests to the codebase?

User: Yes

AI: Tests added to {TEST_UAT_DIR}/FS-2024-NOTIFICATIONS.ts

Feature check complete!
```
