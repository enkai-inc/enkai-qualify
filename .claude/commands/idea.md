# /idea - Idea Capture & Workflow

Capture a feature idea and run it through a feature development workflow.

Read configuration from `.claude/project.config.json` for API endpoints and paths.

Execute the `idea` skill to:
1. Gather idea details (title, description, priority)
2. Create the idea and GitHub issue
3. Run AI research (optional - deep analysis)
4. Run AI planning (optional - implementation approach)
5. Generate feature template (automatic)
6. Gather requirements and clarifications
7. Provide summary with next steps

Arguments:
- `$ARGUMENTS` - Optional idea description (e.g., `Add dark mode to dashboard`)

Examples:
- `/idea` - Start interactive idea capture
- `/idea Add user authentication with OAuth` - Create idea with description
- `/idea Refactor the API layer for better error handling` - Create refactoring idea