"""Pack API routes."""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services.pack import PackAssembler, PackConfig

router = APIRouter(prefix="/packs", tags=["packs"])

# In-memory pack storage (would use a database in production)
_packs_store: dict[str, dict[str, Any]] = {}

# Initialize assembler
assembler = PackAssembler()


class CreatePackRequest(BaseModel):
    """Request body for creating a new pack."""

    module_ids: list[str]
    project_name: str = "my-saas-project"
    include_issues: bool = True
    include_scripts: bool = True


class PackResponse(BaseModel):
    """Response body for pack operations."""

    pack_id: str
    project_name: str
    modules_included: list[str]
    total_work_units: int
    issues_generated: int
    status: str
    download_url: str | None
    download_expiration: str | None
    created_at: str
    errors: list[str]


class ModuleInfo(BaseModel):
    """Module information response."""

    module_id: str
    display_name: str
    description: str
    category: str
    dependencies: list[str]
    work_unit_count: int
    tags: list[str]


class ModulesListResponse(BaseModel):
    """Response body for listing available modules."""

    modules: list[ModuleInfo]
    total: int


@router.post("", response_model=PackResponse)
async def create_pack(request: CreatePackRequest) -> PackResponse:
    """Create a new pack from selected modules.

    Args:
        request: Pack creation request with module IDs and options.

    Returns:
        PackResponse with pack details and download URL.

    Raises:
        HTTPException: If module IDs are invalid or assembly fails.
    """
    if not request.module_ids:
        raise HTTPException(status_code=400, detail="At least one module_id is required")

    config = PackConfig(
        module_ids=request.module_ids,
        project_name=request.project_name,
        include_issues=request.include_issues,
        include_scripts=request.include_scripts,
        upload_to_s3=True,
    )

    try:
        result = assembler.assemble(config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pack assembly failed: {e}") from e

    # Store pack info
    pack_data = result.to_dict()
    pack_data["status"] = "completed" if not result.errors else "completed_with_warnings"
    _packs_store[result.pack_id] = pack_data

    return PackResponse(
        pack_id=result.pack_id,
        project_name=result.project_name,
        modules_included=result.modules_included,
        total_work_units=result.total_work_units,
        issues_generated=result.issues_generated,
        status=pack_data["status"],
        download_url=result.download_url,
        download_expiration=(
            result.download_expiration.isoformat()
            if result.download_expiration
            else None
        ),
        created_at=result.created_at.isoformat(),
        errors=result.errors,
    )


@router.get("/{pack_id}", response_model=PackResponse)
async def get_pack(pack_id: str) -> PackResponse:
    """Get pack status and details.

    Args:
        pack_id: Pack identifier.

    Returns:
        PackResponse with pack details.

    Raises:
        HTTPException: If pack not found.
    """
    if pack_id not in _packs_store:
        raise HTTPException(status_code=404, detail=f"Pack not found: {pack_id}")

    pack_data = _packs_store[pack_id]

    return PackResponse(
        pack_id=pack_data["pack_id"],
        project_name=pack_data["project_name"],
        modules_included=pack_data["modules_included"],
        total_work_units=pack_data["total_work_units"],
        issues_generated=pack_data["issues_generated"],
        status=pack_data["status"],
        download_url=pack_data["download_url"],
        download_expiration=pack_data["download_expiration"],
        created_at=pack_data["created_at"],
        errors=pack_data["errors"],
    )


@router.get("/{pack_id}/download")
async def get_download_url(pack_id: str) -> dict[str, Any]:
    """Get or refresh download URL for a pack.

    Args:
        pack_id: Pack identifier.

    Returns:
        Dictionary with download URL and expiration.

    Raises:
        HTTPException: If pack not found or URL unavailable.
    """
    if pack_id not in _packs_store:
        raise HTTPException(status_code=404, detail=f"Pack not found: {pack_id}")

    pack_data = _packs_store[pack_id]

    if not pack_data.get("download_url"):
        # Try to get URL from storage
        storage = assembler.storage
        result = storage.get_pack_url(pack_id)

        if result is None:
            raise HTTPException(
                status_code=404,
                detail="Download URL not available. Pack may have expired.",
            )

        url, expiration = result
        pack_data["download_url"] = url
        pack_data["download_expiration"] = expiration.isoformat()

    return {
        "pack_id": pack_id,
        "download_url": pack_data["download_url"],
        "download_expiration": pack_data["download_expiration"],
    }


@router.get("", response_model=list[PackResponse])
async def list_packs() -> list[PackResponse]:
    """List all packs.

    Returns:
        List of PackResponse objects.
    """
    return [
        PackResponse(
            pack_id=data["pack_id"],
            project_name=data["project_name"],
            modules_included=data["modules_included"],
            total_work_units=data["total_work_units"],
            issues_generated=data["issues_generated"],
            status=data["status"],
            download_url=data["download_url"],
            download_expiration=data["download_expiration"],
            created_at=data["created_at"],
            errors=data["errors"],
        )
        for data in _packs_store.values()
    ]


@router.get("/modules/available", response_model=ModulesListResponse)
async def list_available_modules() -> ModulesListResponse:
    """List all available modules for pack creation.

    Returns:
        ModulesListResponse with available modules.
    """
    modules = assembler.get_available_modules()

    return ModulesListResponse(
        modules=[
            ModuleInfo(
                module_id=m["module_id"],
                display_name=m["display_name"],
                description=m["description"],
                category=m["category"],
                dependencies=m["dependencies"],
                work_unit_count=m["work_unit_count"],
                tags=m["tags"],
            )
            for m in modules
        ],
        total=len(modules),
    )
