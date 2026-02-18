"""Database operations using asyncpg.

Matches Prisma schema table/column names exactly:
- Table: "Idea" (quoted, PascalCase)
- Table: "IdeaVersion" (quoted, PascalCase)
- Columns: camelCase with quotes
"""

import json
import uuid

import asyncpg
import structlog

from .ai_generator import GeneratedIdea

logger = structlog.get_logger()


async def update_idea_to_draft(
    pool: asyncpg.Pool,
    idea_id: str,
    idea: GeneratedIdea,
) -> bool:
    """Update an idea from PENDING to DRAFT with generated content.

    Returns True if the update succeeded (row found and was PENDING).
    """
    metadata = json.dumps({"marketAnalysis": idea.market_analysis})
    features = json.dumps(idea.features)

    result = await pool.fetchval(
        """
        UPDATE "Idea" SET
            title = $1,
            description = $2,
            technologies = $3,
            features = $4::jsonb,
            metadata = $5::jsonb,
            status = 'DRAFT',
            "updatedAt" = NOW()
        WHERE id = $6 AND status = 'PENDING'
        RETURNING id
        """,
        idea.title,
        idea.description,
        idea.technologies,
        features,
        metadata,
        idea_id,
    )

    if result is None:
        logger.warning("idea_not_found_or_not_pending", idea_id=idea_id)
        return False

    logger.info("idea_updated_to_draft", idea_id=idea_id)
    return True


async def create_idea_version(
    pool: asyncpg.Pool,
    idea_id: str,
    idea: GeneratedIdea,
) -> str:
    """Create initial version snapshot for the idea."""
    version_id = f"c{uuid.uuid4().hex[:24]}"
    snapshot = json.dumps(
        {
            "title": idea.title,
            "description": idea.description,
            "features": idea.features,
            "technologies": idea.technologies,
            "marketAnalysis": idea.market_analysis,
        }
    )

    await pool.execute(
        """
        INSERT INTO "IdeaVersion" (id, "ideaId", version, snapshot, summary, "createdAt")
        VALUES ($1, $2, 1, $3::jsonb, 'AI-generated idea', NOW())
        """,
        version_id,
        idea_id,
        snapshot,
    )

    logger.info("idea_version_created", idea_id=idea_id, version_id=version_id)
    return version_id
