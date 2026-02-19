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

from .ai_generator import GeneratedIdea, RefinedIdea, ValidationResult

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


async def create_validation(
    pool: asyncpg.Pool,
    idea_id: str,
    version: int,
    result: ValidationResult,
) -> str:
    """Create a validation record and optionally update idea status to VALIDATED.

    Returns the validation record ID.
    """
    validation_id = f"c{uuid.uuid4().hex[:24]}"
    details = json.dumps(result.details)

    await pool.execute(
        """
        INSERT INTO "Validation" (
            id, "ideaId", version,
            "keywordScore", "painPointScore", "competitionScore",
            "revenueEstimate", "overallScore", details, "createdAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW())
        """,
        validation_id,
        idea_id,
        version,
        result.keyword_score,
        result.pain_point_score,
        result.competition_score,
        result.revenue_estimate,
        result.overall_score,
        details,
    )

    if result.overall_score >= 60:
        await pool.execute(
            """
            UPDATE "Idea" SET status = 'VALIDATED', "updatedAt" = NOW()
            WHERE id = $1
            """,
            idea_id,
        )
        logger.info("idea_status_updated_to_validated", idea_id=idea_id)

    logger.info("validation_created", idea_id=idea_id, validation_id=validation_id)
    return validation_id


async def update_idea_refinement(
    pool: asyncpg.Pool,
    idea_id: str,
    refined: RefinedIdea,
) -> bool:
    """Update an idea with refined content and create a new version snapshot.

    Returns True if the update succeeded.
    """
    features = json.dumps(refined.features)

    # Get current version
    current_version = await pool.fetchval(
        'SELECT "currentVersion" FROM "Idea" WHERE id = $1',
        idea_id,
    )
    if current_version is None:
        logger.warning("idea_not_found_for_refinement", idea_id=idea_id)
        return False

    next_version = current_version + 1

    # Update idea
    await pool.execute(
        """
        UPDATE "Idea" SET
            title = $1,
            description = $2,
            features = $3::jsonb,
            technologies = $4,
            "currentVersion" = $5,
            "updatedAt" = NOW()
        WHERE id = $6
        """,
        refined.title,
        refined.description,
        features,
        refined.technologies,
        next_version,
        idea_id,
    )

    # Create version snapshot
    version_id = f"c{uuid.uuid4().hex[:24]}"
    snapshot = json.dumps(
        {
            "title": refined.title,
            "description": refined.description,
            "features": refined.features,
            "technologies": refined.technologies,
        }
    )

    # Find parent version ID
    parent_id = await pool.fetchval(
        'SELECT id FROM "IdeaVersion" WHERE "ideaId" = $1 AND version = $2',
        idea_id,
        current_version,
    )

    await pool.execute(
        """
        INSERT INTO "IdeaVersion" (id, "ideaId", version, snapshot, summary, "parentId", "createdAt")
        VALUES ($1, $2, $3, $4::jsonb, $5, $6, NOW())
        """,
        version_id,
        idea_id,
        next_version,
        snapshot,
        refined.summary or "AI-refined idea",
        parent_id,
    )

    logger.info("idea_refined_in_db", idea_id=idea_id, version=next_version)
    return True
