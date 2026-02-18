"""Metis idea generation worker entry point.

Polls GitHub for open issues labeled enkai:build,
generates ideas via Claude, updates the database, and closes issues.

Usage: python -m worker
"""

import asyncio

import asyncpg
import structlog

from .ai_generator import IdeaGenerator
from .config import settings
from .db import create_idea_version, update_idea_to_draft
from .github_client import (
    GENERATION_FAILED_LABEL,
    GitHubClient,
    GitHubIssue,
)
from .issue_parser import ParseError, parse_issue_body

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.dev.ConsoleRenderer(),
    ],
)
logger = structlog.get_logger()

MAX_RETRIES = 3
RETRY_DELAYS = [5, 15, 45]


async def process_issue(
    issue: GitHubIssue,
    github: GitHubClient,
    generator: IdeaGenerator,
    pool: asyncpg.Pool,
) -> None:
    """Process a single idea generation issue."""
    log = logger.bind(issue_number=issue.number)
    log.info("processing_issue", title=issue.title)

    # Parse issue body
    try:
        params = parse_issue_body(issue.body)
    except ParseError as e:
        log.error("parse_failed", error=str(e))
        await github.add_comment(
            issue.number,
            f"Failed to parse issue body: {e}\n\nPlease verify the issue format.",
        )
        return

    # Generate idea with retries
    idea = None
    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            idea = generator.generate(params)
            break
        except Exception as e:
            last_error = e
            log.warning(
                "generation_attempt_failed",
                attempt=attempt + 1,
                error=str(e),
            )
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(RETRY_DELAYS[attempt])

    if idea is None:
        log.error("generation_failed_all_retries", error=str(last_error))
        await github.add_comment(
            issue.number,
            f"Idea generation failed after {MAX_RETRIES} attempts.\n\nError: {last_error}",
        )
        await github.add_label(issue.number, GENERATION_FAILED_LABEL)
        return

    # Update database
    try:
        updated = await update_idea_to_draft(pool, params.idea_id, idea)
        if not updated:
            log.warning("idea_not_updated", idea_id=params.idea_id)
            await github.add_comment(
                issue.number,
                f"Idea `{params.idea_id}` was not found or is not in PENDING status. Skipping.",
            )
            return

        await create_idea_version(pool, params.idea_id, idea)
    except Exception as e:
        log.error("db_update_failed", error=str(e))
        # Don't close the issue - next poll will retry
        return

    # Success - close the issue
    comment = f"""Idea generated successfully!

**Title:** {idea.title}

**Features:** {len(idea.features)} features generated
**Technologies:** {", ".join(idea.technologies)}

The idea has been updated to DRAFT status. View it in the [Metis dashboard](https://metis.digitaldevops.io/ideas)."""

    await github.close_issue(issue.number, comment)
    log.info("issue_processed_successfully", idea_id=params.idea_id)


async def main() -> None:
    """Main polling loop."""
    logger.info(
        "worker_starting",
        poll_interval=settings.poll_interval_seconds,
        repo=f"{settings.github_repo_owner}/{settings.github_repo_name}",
    )

    # Convert asyncpg-compatible URL (strip +asyncpg suffix if present from shared DATABASE_URL)
    db_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")

    pool = await asyncpg.create_pool(db_url)
    github = GitHubClient(settings)
    generator = IdeaGenerator(settings.anthropic_api_key)

    logger.info("worker_ready")

    while True:
        try:
            issues = await github.list_pending_issues()
            if issues:
                logger.info("found_issues", count=len(issues))
            for issue in issues:
                try:
                    await process_issue(issue, github, generator, pool)
                except Exception:
                    logger.exception("issue_processing_error", issue_number=issue.number)
        except Exception:
            logger.exception("poll_cycle_error")

        await asyncio.sleep(settings.poll_interval_seconds)


if __name__ == "__main__":
    asyncio.run(main())
