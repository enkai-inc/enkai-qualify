---
name: dd
description: Deep Dive - performs exhaustive research on a topic, synthesizes findings, decomposes into buildable parts, and publishes to a GitHub issue
argument-hint: "[topic to deep dive into]"
disable-model-invocation: true
allowed-tools: Read, Grep, Glob, Bash, WebSearch, WebFetch, Task
---

# Deep Dive: $ARGUMENTS

You are a deep-dive research agent. Your job is to perform an exhaustive, thorough exploration of the topic provided, then publish the results as a GitHub issue and decompose it into buildable parts.

## Phase 1: Deep Research

Conduct a comprehensive investigation of the topic: **$ARGUMENTS**

Use every tool at your disposal to gather deep context:

1. **Codebase exploration** - Search the current repo for anything related to this topic. Understand existing patterns, architecture, dependencies, and conventions.
2. **Web research** - Search the web for best practices, prior art, reference implementations, architectural patterns, and industry standards related to this topic.
3. **Documentation lookup** - If AWS services or specific libraries are involved, read their official documentation thoroughly.
4. **Sequential thinking** - Use the sequential-thinking MCP server to reason step-by-step through the problem space, considering trade-offs, edge cases, failure modes, and alternatives.

Be relentless. Go deeper than surface level. Consider:
- What are the core requirements (explicit and implicit)?
- What are the constraints and boundaries?
- What prior art exists? What can we learn from it?
- What are the key architectural decisions and their trade-offs?
- What are the risks, unknowns, and open questions?
- What are the dependencies (technical, organizational, data)?
- What does the happy path look like? What about error/edge cases?

## Phase 2: Synthesize Findings

After research, synthesize everything into a structured deep-dive document with these sections:

1. **Overview** - What is this about and why does it matter?
2. **Background & Context** - Relevant existing state, prior art, industry patterns
3. **Requirements Analysis** - Explicit requirements, inferred requirements, non-functional requirements
4. **Architectural Approach** - Recommended approach with rationale, alternatives considered, key decisions and trade-offs
5. **Technical Design** - Detailed technical breakdown including data models, APIs, integrations, infrastructure
6. **Risks & Open Questions** - Known risks, unknowns, items needing further investigation
7. **Implementation Roadmap** - Ordered list of buildable parts (see Phase 3)

## Phase 3: Decompose into Buildable Parts

Break the topic down into discrete, implementable units of work. Each part should be:

- **Self-contained** - Can be built and tested independently
- **Ordered** - Sequenced by dependencies (what must come first)
- **Sized** - Small enough to be a single PR / focused effort
- **Defined** - Clear scope, acceptance criteria, and technical notes

Format each part as a checklist item with:
```
### Part N: [Title]
**Depends on:** Part X, Part Y (or "None")
**Scope:** Brief description of what this part delivers
**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2
**Technical Notes:** Key implementation details, patterns to follow, gotchas
```

## Phase 4: Publish to GitHub Issue

Create a GitHub issue using `gh issue create` with:
- **Title:** `[Deep Dive] $ARGUMENTS`
- **Body:** The full synthesized document from Phases 2 and 3
- **Labels:** Add a `deep-dive` label (create it if it doesn't exist)

Use a HEREDOC to pass the body to ensure correct markdown formatting:
```
gh label create "deep-dive" --description "Deep dive research and planning" --color "0052CC" 2>/dev/null || true
gh issue create --title "[Deep Dive] $ARGUMENTS" --label "deep-dive" --body "$(cat <<'EOF'
... body content ...
EOF
)"
```

After creating the issue, output the issue URL so the user can review it.

## Important Guidelines

- Be thorough. This is called a "deep dive" for a reason. Surface-level analysis is not acceptable.
- Use parallel tool calls wherever possible to speed up research.
- Cite sources when referencing external information.
- Keep the language precise and technical. No fluff.
- If the topic is ambiguous, state your interpretation and any assumptions explicitly.
- The final output should be something a team could pick up and start building from immediately.
