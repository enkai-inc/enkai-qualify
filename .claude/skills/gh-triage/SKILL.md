---
name: gh-triage
description: "Structured GitHub issue triage with deep analysis, priority assessment, and relationship mapping. JSON output for machine processing."
---

# GitHub Issue Triage Skill

Analyze GitHub issues with deep understanding, priority assessment, and relationship mapping. Outputs structured JSON for machine consumption by `/scrum` and `/eval`.

## When to Use

- "Triage the issue queue"
- "Prioritize open issues"
- Before `/scrum` to rank the work queue
- When issue volume exceeds quick manual review

## Triage Protocol

### Step 1: Fetch Issues

```bash
gh issue list --state open --json number,title,body,labels,createdAt,comments --limit 50
```

### Step 2: Deep Analysis (per issue)

For each issue, answer:

1. **What is this actually about?** (beyond keywords — understand the real problem)
2. **Which component/system is affected?**
3. **What is the impact if not addressed?**
4. **What type is it?** bug / feature / question / tech-debt

### Step 3: Priority Assessment

| Priority | Criteria | Examples |
|----------|----------|---------|
| **CRITICAL** | Blocks users, security vuln, data loss | Auth bypass, DB corruption, deploy broken |
| **HIGH** | Major feature broken, important gap | Core workflow fails, missing key feature |
| **MEDIUM** | Workaround exists, minor bug, nice-to-have | UI glitch, minor enhancement, DX improvement |
| **LOW** | Edge case, cosmetic, question | Rare scenario, style nit, "how do I..." |

### Step 4: Relationship Mapping

Identify connections between issues:

- **Duplicates**: Same problem reported differently
- **Related**: Connected by theme, component, or root cause
- **Blocks/Blocked by**: Dependency chains
- **Parent/Child**: Epic → sub-task relationships

### Step 5: Theme Extraction

Group issues by emergent themes:

```
"Authentication Issues": 3 issues, root cause: token refresh logic
"CI/CD Pipeline": 2 issues, root cause: build timeout config
```

## Output Format

Return ONLY valid JSON:

```json
{
  "triaged_at": "2025-01-15T10:30:00Z",
  "total_issues": 12,
  "issues": [
    {
      "number": 123,
      "title": "Login fails after session timeout",
      "deep_understanding": "Token refresh silently fails when session expires during active use, causing 401 errors on next API call.",
      "affected_components": ["auth", "api-client"],
      "issue_type": "bug",
      "priority": "HIGH",
      "priority_rationale": "Affects all users with sessions > 30 minutes",
      "theme": "authentication",
      "relationships": {
        "duplicates_of": [],
        "related_to": [125],
        "blocks": [],
        "blocked_by": []
      },
      "recommended_action": "Fix token refresh, add retry on 401"
    }
  ],
  "themes": {
    "authentication": {
      "count": 3,
      "root_cause": "Token refresh logic incomplete",
      "priority": "HIGH"
    }
  },
  "recommended_order": [123, 125, 130, 128],
  "cleanup_candidates": [115, 118]
}
```

## Field Definitions

| Field | Description |
|-------|-------------|
| `deep_understanding` | 2-3 sentences explaining the real problem |
| `affected_components` | System parts impacted |
| `issue_type` | `bug`, `feature`, `question`, `tech-debt` |
| `priority` | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` |
| `priority_rationale` | Why this priority level |
| `theme` | Category grouping |
| `recommended_action` | Concise next step |
| `recommended_order` | Issues sorted by priority + dependency order |
| `cleanup_candidates` | Issues to close (stale, duplicate, resolved) |

## Integration with /scrum

When `/scrum` starts, it can invoke triage first:
1. Run triage on open issues
2. Use `recommended_order` for queue priority
3. Skip `cleanup_candidates`
4. Group by theme for parallel worker assignment (same-theme = same worker)

## Integration with /eval

When `/eval` picks an issue:
1. Check triage output for `relationships`
2. If duplicates exist, resolve all at once
3. Use `deep_understanding` for implementation context
