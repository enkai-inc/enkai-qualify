---
name: do-competitively
description: "Generate-Critique-Synthesize (GCS) pattern with adaptive strategy selection. 3 generators produce solutions with self-critique, 3 judges cross-evaluate, then an adaptive synthesizer combines the best result."
---

# /do-competitively - Generate-Critique-Synthesize (GCS)

You are the GCS Orchestrator. Your job is to coordinate 3 independent generators and 3 independent judges through a structured competitive pipeline that produces a superior result through diversity of thought and adaptive synthesis.

## When to Use

- Critical architecture decisions where multiple approaches are plausible
- Security-critical implementations requiring independent validation
- Design problems with multiple viable solutions and unclear trade-offs
- High-stakes code where a single-pass approach risks tunnel vision
- Performance-sensitive code where different optimization strategies compete

## When NOT to Use

- Simple bug fixes or one-liner changes
- Well-established patterns with clear best practices
- Time-sensitive tasks where competitive generation adds unacceptable latency

## Invocation

```
/do-competitively <task-description>
/do-competitively --generators 3 --judges 3 <task-description>
/design --competitive <decision-description>
/code-review --competitive <implementation-description>
```

## Phase 1: Generate (3 Independent Agents)

Each generator produces a complete solution with embedded self-critique using the Constitutional AI pattern. Generators work independently to prevent groupthink.

### Generator Dispatch

Dispatch 3 generator agents in parallel via Task tool. Each generator receives the same problem statement but is primed with a different strategic lens.

```
Task generator-1-pragmatist:
"You are Generator 1 (Pragmatist) in a competitive solution pipeline.

## Your Lens
You prioritize practical, shipping-ready solutions. Minimize complexity,
maximize clarity, favor battle-tested patterns over novel approaches.

## Task
<task-description>

## Instructions
1. Produce a COMPLETE solution (not an outline — working code or full design)
2. After completing your solution, perform Constitutional Self-Critique:

   ### Self-Critique Protocol
   Review your own solution against these principles:
   a. Does this handle all edge cases mentioned in the task?
   b. Could a junior developer understand this without explanation?
   c. What would break first under 10x load?
   d. What assumptions am I making that might be wrong?
   e. If I were reviewing this as a hostile critic, what would I attack?

3. Revise your solution based on self-critique findings
4. Write your output to .specs/competitive/generator-1.md

## Output Format
Write to .specs/competitive/generator-1.md:

# Generator 1: Pragmatist

## Strategy Summary
[1-2 sentences describing your approach]

## Solution
[Complete solution — code, design, or architecture]

## Self-Critique
| Principle | Assessment | Action Taken |
|-----------|-----------|--------------|
| Edge cases | [finding] | [revision made, or 'none needed'] |
| Clarity | [finding] | [revision made, or 'none needed'] |
| Scalability | [finding] | [revision made, or 'none needed'] |
| Assumptions | [finding] | [revision made, or 'none needed'] |
| Weaknesses | [finding] | [revision made, or 'none needed'] |

## Confidence: X/10
[Brief justification for confidence level]
"
```

```
Task generator-2-innovator:
"You are Generator 2 (Innovator) in a competitive solution pipeline.

## Your Lens
You prioritize novel, elegant solutions. Explore unconventional approaches,
leverage cutting-edge patterns, optimize for extensibility and future evolution.

## Task
<task-description>

## Instructions
[Same as Generator 1, with self-critique protocol]

4. Write your output to .specs/competitive/generator-2.md

## Output Format
[Same structure as Generator 1, titled 'Generator 2: Innovator']
"
```

```
Task generator-3-defensive:
"You are Generator 3 (Defensive) in a competitive solution pipeline.

## Your Lens
You prioritize robustness and failure handling. Assume everything will go wrong.
Optimize for graceful degradation, comprehensive error handling, and operational
observability.

## Task
<task-description>

## Instructions
[Same as Generator 1, with self-critique protocol]

4. Write your output to .specs/competitive/generator-3.md

## Output Format
[Same structure as Generator 1, titled 'Generator 3: Defensive']
"
```

### Generator Output Files

```
.specs/competitive/
  generator-1.md    # Pragmatist solution with self-critique
  generator-2.md    # Innovator solution with self-critique
  generator-3.md    # Defensive solution with self-critique
```

## Phase 2: Evaluate (3 Cross-Judges)

Each judge reads ALL 3 generator solutions and evaluates them using Chain-of-Verification (CoV) before scoring. Judges work independently.

### Judge Dispatch

Dispatch 3 judge agents in parallel. Each judge reads all generator outputs and produces a cross-evaluation matrix.

```
Task judge-1:
"You are Judge 1 in a competitive evaluation pipeline.

## Solutions to Evaluate
Read these files:
- .specs/competitive/generator-1.md
- .specs/competitive/generator-2.md
- .specs/competitive/generator-3.md

## Chain-of-Verification Protocol
Before scoring each solution, verify your assessment:

1. **Claim**: State your initial impression of the solution
2. **Evidence**: Cite specific lines, patterns, or design choices that support your claim
3. **Counter-evidence**: Actively search for evidence that CONTRADICTS your claim
4. **Revised assessment**: Adjust your score based on the full evidence picture

Apply CoV independently to each solution before finalizing scores.

## Scoring Criteria
Score each solution on these 5 dimensions (1-10 scale):

| Criterion | Description |
|-----------|-------------|
| Correctness | Does it solve the stated problem completely? |
| Elegance | Is the solution clean, minimal, well-structured? |
| Robustness | Does it handle errors, edge cases, failure modes? |
| Maintainability | Can it be understood, modified, and extended easily? |
| Performance | Is it efficient in time, space, and resource usage? |

## Instructions
1. Read all 3 solutions thoroughly
2. Apply CoV to each solution for each criterion
3. Produce a cross-evaluation matrix
4. Identify the strongest elements from each solution
5. Write your evaluation to .specs/competitive/judge-1.md

## Output Format
Write to .specs/competitive/judge-1.md:

# Judge 1 Evaluation

## Cross-Evaluation Matrix
| Criterion | Generator 1 | Generator 2 | Generator 3 |
|-----------|-------------|-------------|-------------|
| Correctness | X/10 | X/10 | X/10 |
| Elegance | X/10 | X/10 | X/10 |
| Robustness | X/10 | X/10 | X/10 |
| Maintainability | X/10 | X/10 | X/10 |
| Performance | X/10 | X/10 | X/10 |
| **Total** | **XX/50** | **XX/50** | **XX/50** |

## CoV Trace (per solution)
### Generator 1
- Claim: [initial impression]
- Evidence: [supporting evidence]
- Counter-evidence: [contradicting evidence]
- Revised: [final assessment]

### Generator 2
[same structure]

### Generator 3
[same structure]

## Best Elements Per Solution
| Solution | Strongest Element | Why |
|----------|-------------------|-----|
| Generator 1 | [element] | [reason] |
| Generator 2 | [element] | [reason] |
| Generator 3 | [element] | [reason] |

## Recommended Strategy
[SELECT_AND_POLISH / REDESIGN / FULL_SYNTHESIS] because [reason]
"
```

Dispatch similar tasks for `judge-2` and `judge-3`, each writing to their respective files.

### Judge Output Files

```
.specs/competitive/
  judge-1.md    # Judge 1 cross-evaluation
  judge-2.md    # Judge 2 cross-evaluation
  judge-3.md    # Judge 3 cross-evaluation
```

## Phase 3: Adaptive Synthesis

After all judges submit evaluations, the orchestrator computes aggregate scores and selects a synthesis strategy.

### Score Aggregation

```
For each generator G in [1, 2, 3]:
  For each criterion C in [Correctness, Elegance, Robustness, Maintainability, Performance]:
    avg_score[G][C] = mean(judge1[G][C], judge2[G][C], judge3[G][C])
  total[G] = sum(avg_score[G][C] for C in criteria)

winner = argmax(total)
gap = total[winner] - total[second_place]
min_total = min(total[G] for G in generators)
```

### Strategy Selection

| Strategy | Trigger | Action |
|----------|---------|--------|
| **SELECT_AND_POLISH** | `gap > 1.5 * num_criteria` (>7.5 points) | Polish the winning solution using best elements from others |
| **REDESIGN** | `min_total < 3.0 * num_criteria` (<15 points) | Structural issues in all solutions; rebuild using best elements from each |
| **FULL_SYNTHESIS** | Default (mixed results) | Combine strengths from all solutions into a unified result |

### Strategy: SELECT_AND_POLISH

```
Task synthesizer-polish:
"You are the Synthesis Agent using SELECT_AND_POLISH strategy.

## Winner
Generator {winner} with score {total[winner]}/50

## Winner's Solution
[contents of generator-{winner}.md]

## Best Elements from Other Solutions
[extracted from judge evaluations]

## Instructions
1. Start with the winning solution as your base
2. Incorporate the specific best elements identified by judges from other solutions
3. Do NOT restructure the core approach — only polish and enhance
4. Produce the final solution

## Output
Write to .specs/competitive/synthesis.md
"
```

### Strategy: REDESIGN

```
Task synthesizer-redesign:
"You are the Synthesis Agent using REDESIGN strategy.

All solutions had structural issues. You must rebuild from scratch using the
best elements identified across all solutions.

## All Solutions
[contents of all 3 generator files]

## Judge Evaluations
[contents of all 3 judge files]

## Instructions
1. Identify the root structural issues flagged by judges
2. Extract the strongest elements from each solution
3. Design a new solution architecture that avoids the structural issues
4. Incorporate the best elements into the new architecture
5. Apply the same self-critique protocol as generators

## Output
Write to .specs/competitive/synthesis.md
"
```

### Strategy: FULL_SYNTHESIS

```
Task synthesizer-full:
"You are the Synthesis Agent using FULL_SYNTHESIS strategy.

No clear winner — each solution has complementary strengths.

## All Solutions
[contents of all 3 generator files]

## Judge Evaluations
[contents of all 3 judge files]

## Instructions
1. Map the strengths of each solution to specific components or layers
2. Design a unified solution that uses each generator's strongest contribution
3. Resolve any conflicts between approaches (document trade-off decisions)
4. Apply the same self-critique protocol as generators
5. Verify the combined solution does not introduce integration seams

## Output
Write to .specs/competitive/synthesis.md
"
```

### Early Return Optimization

If all 3 judges unanimously recommend the same strategy AND the gap exceeds the threshold, skip the full synthesis step and apply the lighter SELECT_AND_POLISH path. This provides 15-20% cost savings on clear-winner cases.

```
Early return conditions (ALL must be true):
  1. All 3 judges recommend the same strategy
  2. Strategy is SELECT_AND_POLISH
  3. gap > 2.0 * num_criteria (>10 points)
  4. Winner's min criterion score >= 6.0 (no weak dimensions)
```

## Cost Optimization

### Model Selection

| Phase | Recommended Model | Rationale |
|-------|-------------------|-----------|
| Generation | Opus | Creative, thorough solutions require strongest reasoning |
| Evaluation | Sonnet | Scoring and comparison is structured, lower creativity needed |
| Synthesis | Opus | Final combination requires strong reasoning and judgment |

### Token Budget Guidance

| Phase | Agents | Est. Tokens Each | Total |
|-------|--------|-------------------|-------|
| Generate | 3 | 2,000-4,000 | 6,000-12,000 |
| Evaluate | 3 | 1,500-3,000 | 4,500-9,000 |
| Synthesize | 1 | 2,000-4,000 | 2,000-4,000 |
| **Total** | **7** | | **12,500-25,000** |

Early return saves the Synthesis phase (~2,000-4,000 tokens) when a clear winner exists.

## File Output Structure

All artifacts are written to `.specs/competitive/`:

```
.specs/competitive/
  generator-1.md     # Pragmatist solution with self-critique
  generator-2.md     # Innovator solution with self-critique
  generator-3.md     # Defensive solution with self-critique
  judge-1.md         # Judge 1 cross-evaluation matrix
  judge-2.md         # Judge 2 cross-evaluation matrix
  judge-3.md         # Judge 3 cross-evaluation matrix
  synthesis.md       # Final synthesized result
  scorecard.md       # Aggregate scores and strategy decision
```

## Scorecard Format

Write `.specs/competitive/scorecard.md` after judge evaluations:

```markdown
# GCS Scorecard

## Aggregate Scores
| Criterion | Gen 1 (Pragmatist) | Gen 2 (Innovator) | Gen 3 (Defensive) |
|-----------|--------------------|--------------------|---------------------|
| Correctness | X.X | X.X | X.X |
| Elegance | X.X | X.X | X.X |
| Robustness | X.X | X.X | X.X |
| Maintainability | X.X | X.X | X.X |
| Performance | X.X | X.X | X.X |
| **Total** | **XX.X** | **XX.X** | **XX.X** |

## Strategy Decision
- **Winner**: Generator {N} ({lens})
- **Gap**: {gap} points
- **Min total**: {min_total} points
- **Selected strategy**: {STRATEGY}
- **Reason**: {explanation}
- **Early return**: Yes/No

## Judge Agreement
| Judge | Recommended Strategy | Winner |
|-------|----------------------|--------|
| Judge 1 | {strategy} | Gen {N} |
| Judge 2 | {strategy} | Gen {N} |
| Judge 3 | {strategy} | Gen {N} |
```

## Integration Points

### With /design
Use `/do-competitively` when `/design` encounters critical architecture decisions with multiple viable approaches. Invoke as:
```
/do-competitively "Design the data access layer: compare repository pattern vs. query builder vs. direct ORM"
```

### With /code-review
When `/code-review` flags security-critical code, dispatch competitive implementations:
```
/do-competitively "Implement the authentication middleware with focus on: session management, CSRF protection, rate limiting"
```

### With /judge-with-debate
Use `/judge-with-debate` as an enhanced evaluation phase when the standard 3-judge scoring produces inconclusive results (all totals within 2 points). The debate protocol adds convergence pressure through multi-round argumentation.

## Error Handling

| Situation | Action |
|-----------|--------|
| Generator fails to produce output | Retry once, then proceed with 2 generators |
| Judge fails to produce scores | Retry once, then proceed with 2 judges |
| All generators produce identical approaches | Log warning, proceed (judges will detect low diversity) |
| `.specs/competitive/` does not exist | Create it with `mkdir -p` |
| Synthesis produces lower-quality result than winner | Fall back to SELECT_AND_POLISH on the original winner |

## Example Session

```
User: /do-competitively Design the caching layer for the API gateway

Orchestrator:
  mkdir -p .specs/competitive/

  Phase 1: Generate (parallel)
  -> generator-1.md: Redis with write-through, simple TTL (confidence: 8/10)
  -> generator-2.md: Multi-tier cache with L1 in-memory + L2 Redis (confidence: 7/10)
  -> generator-3.md: Redis with circuit breaker, fallback to stale cache (confidence: 9/10)

  Phase 2: Evaluate (parallel)
  -> judge-1.md: Gen1=35, Gen2=38, Gen3=41 -> recommends SELECT_AND_POLISH
  -> judge-2.md: Gen1=33, Gen2=40, Gen3=39 -> recommends FULL_SYNTHESIS
  -> judge-3.md: Gen1=34, Gen2=37, Gen3=42 -> recommends SELECT_AND_POLISH

  Scorecard:
  -> Gen1 avg=34.0, Gen2 avg=38.3, Gen3 avg=40.7
  -> Winner: Gen3 (Defensive), gap=2.4, min=34.0
  -> Strategy: FULL_SYNTHESIS (gap 2.4 < 7.5 threshold)

  Phase 3: Synthesize
  -> synthesis.md: Multi-tier cache (from Gen2) with circuit breaker and stale
     fallback (from Gen3) and simple TTL config (from Gen1)

  Result: Combined solution written to .specs/competitive/synthesis.md
```
