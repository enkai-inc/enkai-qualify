# Decision Log: [Feature Name]

Track all decisions made during the design process for traceability and future reference.

## How to Use This Log

1. Add a new entry for every significant decision
2. Include context, options, and rationale
3. Link to relevant artifacts
4. Note reversibility

---

## Decisions

<!-- Copy this template for each new decision -->

### Decision: [Title]

**Date**: YYYY-MM-DD
**Phase**: discover | define | develop | deliver
**Decided By**: [Agent name or "Human"]

#### Context
[What prompted this decision? What problem were we trying to solve?]

#### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | [description] | [pros] | [cons] |
| B | [description] | [pros] | [cons] |
| C | [description] | [pros] | [cons] |

#### Decision
**Chosen**: [Option A/B/C]

**Rationale**: [Why was this option selected?]

#### Implications
- **Unblocks**: [What can now proceed?]
- **Constrains**: [What future decisions are affected?]
- **Reversibility**: High | Medium | Low

#### Evidence
- [Link to relevant artifact or external reference]

---

<!-- Example entry -->

### Decision: Authentication Approach

**Date**: 2026-02-14
**Phase**: define
**Decided By**: design-tech-lead

#### Context
Need to determine how users will authenticate to the new feature. Must balance security with user experience.

#### Options Considered

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | JWT tokens | Stateless, scalable | Token refresh complexity |
| B | Session cookies | Simple, built-in | Scaling challenges |
| C | OAuth 2.0 | Standard, third-party support | Implementation overhead |

#### Decision
**Chosen**: Option A - JWT tokens

**Rationale**: Aligns with existing API infrastructure. Stateless nature fits our ECS Fargate architecture.

#### Implications
- **Unblocks**: API contract design can proceed
- **Constrains**: Must implement token refresh logic
- **Reversibility**: Low (affects all API endpoints)

#### Evidence
- [define/architecture-sketch.md#L45](define/architecture-sketch.md#L45)
- [define/core-data-model.md](define/core-data-model.md)

---

## Decision Index

| # | Decision | Phase | Date | Reversibility |
|---|----------|-------|------|---------------|
| 1 | [Title] | [phase] | YYYY-MM-DD | High/Med/Low |

---

*This log is maintained throughout the design process. All significant decisions should be documented here for future reference and onboarding.*
