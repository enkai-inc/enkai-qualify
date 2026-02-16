---
name: deps
description: Audit dependencies for security vulnerabilities, outdated packages, and license compliance
---

# Dependency Audit Skill

Security audit, outdated package detection, and upgrade assistance.

**Configuration**: Read `.claude/project.config.json` for:
- Dashboard path: `paths.dashboard_dir`
- Builder path: `paths.builder_dir`
- Infrastructure path: `paths.infra_dir`

## Invocation

```
/deps                # Full audit (security + outdated)
/deps security       # Security vulnerabilities only
/deps outdated       # Outdated packages only
/deps upgrade <pkg>  # Guided upgrade for specific package
```

## Workflow: Security Audit

### Step 1: Run npm audit

```bash
cd {paths.dashboard_dir} && npm audit --json 2>&1 | head -500
```

### Step 2: Parse Vulnerabilities

Extract:
- Severity levels (critical, high, moderate, low)
- Affected packages and paths
- Available fix versions
- Whether `npm audit fix` can resolve automatically

### Step 3: Run pip audit (if Python components exist)

```bash
cd {paths.builder_dir} && pip audit --format json 2>/dev/null | head -200
```

### Step 4: Report

```json
{
  "status": "vulnerabilities_found|clean",
  "summary": "2 critical, 1 high, 3 moderate vulnerabilities",
  "npm": {
    "critical": [],
    "high": [{"package": "lodash", "version": "4.17.20", "fix": "4.17.21", "advisory": "Prototype Pollution"}],
    "moderate": [],
    "autoFixable": 2,
    "requiresManual": 1
  },
  "python": {
    "vulnerabilities": []
  }
}
```

## Workflow: Outdated Packages

### Step 1: Check outdated

```bash
cd {paths.dashboard_dir} && npm outdated --json 2>&1
```

### Step 2: Categorize Updates

- **Patch updates** (safe): 1.2.3 → 1.2.4
- **Minor updates** (usually safe): 1.2.3 → 1.3.0
- **Major updates** (breaking): 1.2.3 → 2.0.0

### Step 3: Report with Risk Assessment

List outdated packages grouped by risk level. Flag packages that are 2+ major versions behind.

## Workflow: Guided Upgrade

### Step 1: Research Breaking Changes

For the target package:
- Check changelog/release notes
- Identify breaking changes
- Check peer dependency requirements

### Step 2: Upgrade

```bash
cd {paths.dashboard_dir} && npm install <package>@latest
```

### Step 3: Verify

Run quality gates after upgrade:
```bash
npm run lint && npm run type-check && npm test
```

### Step 4: Fix Breaking Changes

If quality gates fail, fix code to match new API.

## Instructions for AI

1. Always run security audit first — vulnerabilities are highest priority
2. Don't auto-upgrade major versions without user confirmation
3. For critical vulnerabilities, suggest immediate action
4. Check if vulnerabilities are in production dependencies vs devDependencies
5. Consider transitive dependency impacts when upgrading
