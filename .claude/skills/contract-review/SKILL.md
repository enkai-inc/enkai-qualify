---
name: contract-review
description: "Type design and contract stability reviewer. 8th dimension for code review: data model quality, encapsulation, and contract evolution."
---

# Contract Review Skill

Specialized review for type design, contract stability, encapsulation quality, and data model design. Fills the 8th review dimension alongside the existing 7 in `/code-review`.

## Philosophy

**Make illegal states unrepresentable.** Types are the first line of defense. If the type system permits an invalid state, no amount of runtime validation will reliably prevent it.

## When to Use

- Reviewing API contracts, DTOs, or shared interfaces
- Evaluating data model changes (database schemas, entity boundaries)
- Assessing breaking changes in public APIs or shared libraries
- Pre-merge review of type-heavy PRs (new models, schema migrations)
- Alongside `/code-review` for a complete 8-dimension review

## Invocation

```
/contract-review
/contract-review <file1> <file2> ...
```

## Review Dimensions

### 1. Contract Stability

Evaluate how changes affect consumers of the contract.

| Check | What to Look For |
|-------|-----------------|
| Breaking vs non-breaking | Removed fields, narrowed types, changed semantics |
| Migration path | Versioned endpoints, deprecation markers, adapter layers |
| Backward compatibility | Optional new fields, additive-only enums, default values |
| Forward compatibility | Unknown field handling, extensible discriminators |
| Dependency direction | Contracts flow from domain outward, not inward |

### 2. Encapsulation Quality

Evaluate how well types protect their invariants.

| Check | What to Look For |
|-------|-----------------|
| Invariant enforcement | Constructor validation, factory methods, private fields |
| Mutation control | Readonly properties, immutable collections, defensive copies |
| Minimal interface | No unnecessary public members, internal implementation hidden |
| Information hiding | Implementation details not leaked through return types |
| Boundary validation | Validated at entry points, trusted internally |

### 3. Data Model Design

Evaluate entity structure and domain modeling quality.

| Check | What to Look For |
|-------|-----------------|
| Entity boundaries | Clear aggregate roots, no god objects |
| Value objects | Immutable types for concepts like Money, Email, DateRange |
| Normalization | No redundant data, single source of truth |
| Relationship clarity | Ownership vs reference, cascade behavior explicit |
| Domain alignment | Types reflect business concepts, not infrastructure |

## 20-Item Checklist

Rate each item: PASS / WARN / FAIL

### Type Design (Items 1-8)

1. **Primitive obsession** -- Are raw strings/numbers used where a domain type should exist? (e.g., `userId: string` vs `UserId` branded type)
2. **Anemic models** -- Do types have data but no behavior? Are invariants enforced externally?
3. **Discriminated unions** -- Are union types used instead of boolean flags or string enums for state modeling?
4. **Boolean blindness** -- Are booleans used where a named type would be clearer? (e.g., `isActive: boolean` vs `Status.Active`)
5. **Type narrowing** -- Are type guards and narrowing used to eliminate impossible states in control flow?
6. **Exhaustive matching** -- Do switch/match statements handle all variants? Is `never` used to catch unhandled cases?
7. **Branded types** -- Are structurally identical but semantically different types distinguished? (e.g., `UserId` vs `OrderId`)
8. **Opaque types** -- Are internal representations hidden behind type aliases or newtypes?

### Contract Stability (Items 9-14)

9. **Breaking change detection** -- Are removed or renamed fields flagged as breaking?
10. **Deprecation markers** -- Are deprecated fields/methods annotated with migration guidance?
11. **Version strategy** -- Is there a clear versioning approach for API contracts?
12. **Default values** -- Do new required fields have sensible defaults or migration scripts?
13. **Enum evolution** -- Are enums additive-only? Is there an `Unknown` variant for forward compatibility?
14. **Serialization safety** -- Do serialized forms survive round-trips without data loss?

### Encapsulation (Items 15-18)

15. **Readonly by default** -- Are properties immutable unless mutation is explicitly needed?
16. **Minimal public surface** -- Are only necessary members exported/public?
17. **Constructor validation** -- Are invariants checked at construction time, not caller-side?
18. **Defensive boundaries** -- Are inputs validated at module boundaries, trusted internally?

### Data Model (Items 19-20)

19. **Single source of truth** -- Is each piece of data owned by exactly one entity?
20. **Aggregate boundaries** -- Are transactional boundaries explicit and appropriately scoped?

## Severity Mapping

| Severity | Criteria | Examples |
|----------|----------|----------|
| **CRITICAL** | Contract broken, data loss possible, invariant violation in production | Removed required field without migration; mutable shared state in concurrent context |
| **HIGH** | Breaking change without migration path, invariant not enforced | Enum variant removed; public constructor bypasses validation |
| **MEDIUM** | Primitive obsession, anemic model, missing type narrowing | `string` used for email; boolean flags instead of union types |
| **LOW** | Minor encapsulation improvement, naming clarity, documentation gap | Public field could be readonly; missing JSDoc on exported type |

## Output Format

```json
{
  "approved": false,
  "dimension": "contract-review",
  "summary": "Brief assessment of type design and contract quality",
  "checklist": {
    "passed": 16,
    "warned": 2,
    "failed": 2,
    "items": [
      { "id": 1, "name": "primitive-obsession", "status": "FAIL", "note": "userId is raw string across 4 files" },
      { "id": 6, "name": "exhaustive-matching", "status": "WARN", "note": "Switch on status missing 'cancelled' case" }
    ]
  },
  "issues": [
    {
      "severity": "HIGH",
      "category": "contract-stability",
      "file": "src/types/order.ts",
      "line": 15,
      "message": "Required field 'shippingAddress' removed without deprecation period",
      "suggestion": "Mark as optional with @deprecated annotation, add migration to backfill"
    }
  ],
  "passed": [
    "Discriminated unions used for order status",
    "Value objects for Money and Currency",
    "Readonly properties throughout"
  ],
  "stats": { "critical": 0, "high": 1, "medium": 2, "low": 1 }
}
```

## Approval Rules

- **Approve**: Zero CRITICAL + zero HIGH issues
- **Warn**: MEDIUM issues only (can merge with justification)
- **Block**: Any CRITICAL or HIGH issue present

## Integration with Code Review

This skill provides the 8th dimension for the code review framework:

| Dimension | Skill |
|-----------|-------|
| 1-7 | `/code-review` (quality, maintainability, documentation, performance, security, error handling, testing) |
| 8 | `/contract-review` (type design, contract stability, encapsulation, data model) |

For a complete review, run both:
```
/code-review
/contract-review
```

## Guidelines

1. **Types over tests** -- If the type system can prevent a bug, prefer that over a test
2. **Additive changes** -- New fields should be optional; removed fields need migration
3. **Domain language** -- Types should use ubiquitous language from the business domain
4. **Composition over inheritance** -- Prefer discriminated unions and interfaces over class hierarchies
5. **Boundary validation** -- Validate at the edge, trust internally
