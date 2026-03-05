"""Pack assembler - orchestrates the full pack building pipeline."""

import json
import tempfile
import zipfile
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from pydantic import BaseModel

from .issues import GeneratedIssue, IssueGenerator
from .resolver import DependencyResolver, Module, ModuleCategory, WorkUnit
from .scaffold import ScaffoldGenerator
from .storage import PackStorage


class PackConfig(BaseModel):
    """Configuration for pack assembly."""

    module_ids: list[str]
    project_name: str = "my-saas-project"
    include_issues: bool = True
    include_scripts: bool = True
    upload_to_s3: bool = True


@dataclass
class PackResult:
    """Result of pack assembly."""

    pack_id: str
    project_name: str
    modules_included: list[str]
    total_work_units: int
    issues_generated: int
    zip_path: str | None
    download_url: str | None
    download_expiration: datetime | None
    created_at: datetime
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "pack_id": self.pack_id,
            "project_name": self.project_name,
            "modules_included": self.modules_included,
            "total_work_units": self.total_work_units,
            "issues_generated": self.issues_generated,
            "zip_path": self.zip_path,
            "download_url": self.download_url,
            "download_expiration": (
                self.download_expiration.isoformat()
                if self.download_expiration
                else None
            ),
            "created_at": self.created_at.isoformat(),
            "errors": self.errors,
        }


class PackAssembler:
    """Orchestrates the full pack building pipeline."""

    def __init__(
        self,
        modules_dir: str | Path | None = None,
        templates_dir: str | Path | None = None,
    ) -> None:
        """Initialize the pack assembler.

        Args:
            modules_dir: Path to modules JSON directory.
            templates_dir: Path to Jinja2 templates directory.
        """
        self.modules_dir = Path(modules_dir) if modules_dir else None
        self.templates_dir = Path(templates_dir) if templates_dir else None

        self.issue_generator = IssueGenerator()
        self.scaffold_generator = ScaffoldGenerator(templates_dir)
        self.storage = PackStorage()

        self._modules_cache: dict[str, Module] | None = None

    def assemble(self, config: PackConfig) -> PackResult:
        """Assemble a complete pack from configuration.

        Pipeline:
            1. Load and resolve module dependencies
            2. Collect work units from modules
            3. Generate scaffold
            4. Generate GitHub issues
            5. Create zip archive
            6. Upload to S3 (optional)

        Args:
            config: Pack configuration.

        Returns:
            PackResult with assembly details.
        """
        pack_id = f"pack-{uuid4().hex[:8]}"
        errors: list[str] = []
        created_at = datetime.now(timezone.utc)

        # Step 1: Load and resolve dependencies
        try:
            modules = self._resolve_modules(config.module_ids)
        except Exception as e:
            return PackResult(
                pack_id=pack_id,
                project_name=config.project_name,
                modules_included=[],
                total_work_units=0,
                issues_generated=0,
                zip_path=None,
                download_url=None,
                download_expiration=None,
                created_at=created_at,
                errors=[f"Failed to resolve modules: {e}"],
            )

        # Step 2: Collect work units
        work_units = self._collect_work_units(modules)

        # Step 3: Generate scaffold
        try:
            scaffold = self.scaffold_generator.generate_scaffold(modules)
        except Exception as e:
            errors.append(f"Scaffold generation warning: {e}")
            scaffold = {"structure": {}, "files": {}, "dependencies": {}}

        # Step 4: Generate issues
        issues: list[GeneratedIssue] = []
        if config.include_issues:
            try:
                issues = self.issue_generator.generate_issues(modules)
            except Exception as e:
                errors.append(f"Issue generation warning: {e}")

        # Step 5: Create zip archive
        try:
            zip_path = self._create_zip(
                pack_id=pack_id,
                project_name=config.project_name,
                modules=modules,
                scaffold=scaffold,
                issues=issues,
                include_scripts=config.include_scripts,
            )
        except Exception as e:
            return PackResult(
                pack_id=pack_id,
                project_name=config.project_name,
                modules_included=[m.module_id for m in modules],
                total_work_units=len(work_units),
                issues_generated=len(issues),
                zip_path=None,
                download_url=None,
                download_expiration=None,
                created_at=created_at,
                errors=[f"Failed to create zip: {e}"] + errors,
            )

        # Step 6: Upload to S3
        download_url = None
        download_expiration = None

        if config.upload_to_s3:
            try:
                download_url, download_expiration = self.storage.upload_pack(
                    zip_path=zip_path,
                    pack_id=pack_id,
                    metadata={
                        "project-name": config.project_name,
                        "module-count": str(len(modules)),
                        "work-unit-count": str(len(work_units)),
                    },
                )
            except Exception as e:
                errors.append(f"S3 upload warning: {e}")

        return PackResult(
            pack_id=pack_id,
            project_name=config.project_name,
            modules_included=[m.module_id for m in modules],
            total_work_units=len(work_units),
            issues_generated=len(issues),
            zip_path=str(zip_path),
            download_url=download_url,
            download_expiration=download_expiration,
            created_at=created_at,
            errors=errors,
        )

    def _resolve_modules(self, module_ids: list[str]) -> list[Module]:
        """Load and resolve module dependencies.

        Args:
            module_ids: List of module IDs to include.

        Returns:
            List of modules in dependency order.
        """
        all_modules = self._load_modules()
        resolver = DependencyResolver(all_modules)
        return resolver.resolve_dependencies(module_ids)

    def _load_modules(self) -> dict[str, Module]:
        """Load module definitions from JSON files.

        Returns:
            Dictionary of module_id -> Module.
        """
        if self._modules_cache is not None:
            return self._modules_cache

        modules: dict[str, Module] = {}

        # Default modules directory
        if self.modules_dir is None:
            self.modules_dir = (
                Path(__file__).parent.parent.parent.parent.parent / "modules"
            )

        if not self.modules_dir.exists():
            return modules

        for json_file in self.modules_dir.glob("*.json"):
            try:
                with open(json_file) as f:
                    data = json.load(f)

                work_units = [
                    WorkUnit(
                        work_item_id=wu["workItemId"],
                        title=wu["title"],
                        files=wu.get("files", []),
                    )
                    for wu in data.get("workUnits", [])
                ]

                module = Module(
                    module_id=data["moduleId"],
                    display_name=data["displayName"],
                    description=data["description"],
                    category=ModuleCategory(data["category"]),
                    dependencies=data.get("dependencies", []),
                    work_units=work_units,
                    tags=data.get("tags", []),
                )

                modules[module.module_id] = module

            except (json.JSONDecodeError, KeyError, ValueError) as e:
                # Skip invalid module files
                continue

        self._modules_cache = modules
        return modules

    def _collect_work_units(self, modules: list[Module]) -> list[WorkUnit]:
        """Collect all work units from modules.

        Args:
            modules: List of modules.

        Returns:
            List of all work units.
        """
        work_units: list[WorkUnit] = []
        for module in modules:
            work_units.extend(module.work_units)
        return work_units

    def _create_zip(
        self,
        pack_id: str,
        project_name: str,
        modules: list[Module],
        scaffold: dict[str, Any],
        issues: list[GeneratedIssue],
        include_scripts: bool,
    ) -> Path:
        """Create the pack zip archive.

        Args:
            pack_id: Pack identifier.
            project_name: Project name for root directory.
            modules: List of resolved modules.
            scaffold: Generated scaffold.
            issues: Generated issues.
            include_scripts: Whether to include setup scripts.

        Returns:
            Path to the created zip file.
        """
        temp_dir = Path(tempfile.mkdtemp())
        zip_path = temp_dir / f"{pack_id}.zip"

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            root = project_name

            # Add scaffold files
            for file_path, content in scaffold.get("files", {}).items():
                zf.writestr(f"{root}/{file_path}", content)

            # Add module manifest
            manifest = {
                "pack_id": pack_id,
                "project_name": project_name,
                "modules": [
                    {
                        "module_id": m.module_id,
                        "display_name": m.display_name,
                        "category": m.category.value,
                        "work_units": len(m.work_units),
                    }
                    for m in modules
                ],
                "total_work_units": sum(len(m.work_units) for m in modules),
            }
            zf.writestr(
                f"{root}/enkai-qualify-manifest.json",
                json.dumps(manifest, indent=2),
            )

            # Add issues
            if issues:
                issues_dir = f"{root}/.enkai-qualify/issues"
                for issue in issues:
                    issue_content = {
                        "title": issue.title,
                        "body": issue.body,
                        "labels": issue.labels,
                        "module_id": issue.module_id,
                        "work_item_id": issue.work_item_id,
                    }
                    zf.writestr(
                        f"{issues_dir}/{issue.work_item_id}.json",
                        json.dumps(issue_content, indent=2),
                    )

                # Add issues index
                issues_index = [
                    {
                        "work_item_id": i.work_item_id,
                        "title": i.title,
                        "module_id": i.module_id,
                    }
                    for i in issues
                ]
                zf.writestr(
                    f"{issues_dir}/index.json",
                    json.dumps(issues_index, indent=2),
                )

            # Add scripts
            if include_scripts:
                scripts_content = self._generate_scripts(project_name)
                for script_name, content in scripts_content.items():
                    zf.writestr(f"{root}/scripts/{script_name}", content)

        return zip_path

    def _generate_scripts(self, project_name: str) -> dict[str, str]:
        """Generate setup scripts.

        Args:
            project_name: Project name.

        Returns:
            Dictionary of script name -> content.
        """
        setup_script = f"""#!/bin/bash
# Setup script for {project_name}
# Generated by Enkai Qualify Pack Assembler

set -e

echo "Setting up {project_name}..."

# Initialize git repository
if [ ! -d .git ]; then
    git init
    git add .
    git commit -m "Initial commit from Enkai Qualify pack"
fi

# Install dashboard dependencies
if [ -d dashboard ]; then
    echo "Installing dashboard dependencies..."
    cd dashboard
    npm install
    cd ..
fi

# Install API dependencies
if [ -d api ]; then
    echo "Installing API dependencies..."
    cd api
    pip install -e .
    cd ..
fi

echo "Setup complete!"
echo "Run 'cd {project_name} && ./scripts/import-issues.sh' to create GitHub issues."
"""

        import_script = f"""#!/bin/bash
# Import issues to GitHub for {project_name}
# Generated by Enkai Qualify Pack Assembler

set -e

ISSUES_DIR=".enkai-qualify/issues"

if [ ! -d "$ISSUES_DIR" ]; then
    echo "No issues directory found at $ISSUES_DIR"
    exit 1
fi

echo "Importing issues to GitHub..."

for issue_file in "$ISSUES_DIR"/*.json; do
    if [ "$issue_file" = "$ISSUES_DIR/index.json" ]; then
        continue
    fi

    title=$(jq -r '.title' "$issue_file")
    body=$(jq -r '.body' "$issue_file")
    labels=$(jq -r '.labels | join(",")' "$issue_file")

    echo "Creating issue: $title"
    gh issue create --title "$title" --body "$body" --label "$labels" || true
done

echo "Issue import complete!"
"""

        return {
            "setup-repo.sh": setup_script,
            "import-issues.sh": import_script,
        }

    def get_available_modules(self) -> list[dict[str, Any]]:
        """Get list of available modules.

        Returns:
            List of module info dictionaries.
        """
        modules = self._load_modules()
        return [
            {
                "module_id": m.module_id,
                "display_name": m.display_name,
                "description": m.description,
                "category": m.category.value,
                "dependencies": m.dependencies,
                "work_unit_count": len(m.work_units),
                "tags": m.tags,
            }
            for m in modules.values()
        ]
