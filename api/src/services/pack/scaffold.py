"""Scaffold generation for module packs."""

from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

from .resolver import Module


class ScaffoldGenerator:
    """Generates project scaffolding from module definitions."""

    def __init__(self, templates_dir: str | Path | None = None) -> None:
        """Initialize scaffold generator.

        Args:
            templates_dir: Path to Jinja2 templates directory.
        """
        if templates_dir is None:
            # Default to templates/scaffold relative to project root
            templates_dir = Path(__file__).parent.parent.parent.parent.parent / "templates" / "scaffold"

        self.templates_dir = Path(templates_dir)
        self.env = Environment(
            loader=FileSystemLoader(str(self.templates_dir)),
            autoescape=select_autoescape(
                enabled_extensions=("html", "htm", "xml"),
                default_for_string=False,
            ),
            keep_trailing_newline=True,
        )

    def generate_scaffold(self, modules: list[Module]) -> dict[str, Any]:
        """Generate project scaffold from modules.

        Args:
            modules: List of modules to include in scaffold.

        Returns:
            Dictionary with:
                - structure: dict mapping directory -> list of files
                - files: dict mapping path -> content
                - dependencies: merged dependencies by type
        """
        structure = self._build_structure(modules)
        dependencies = self._merge_dependencies(modules)
        files = self._generate_files(modules, dependencies)

        return {
            "structure": structure,
            "files": files,
            "dependencies": dependencies,
        }

    def _build_structure(self, modules: list[Module]) -> dict[str, list[str]]:
        """Build directory structure from modules.

        Args:
            modules: List of modules.

        Returns:
            Dictionary mapping directory -> list of files.
        """
        structure: dict[str, list[str]] = {
            "dashboard": [],
            "api": [],
            "infra": [],
            "shared": [],
        }

        for module in modules:
            for work_unit in module.work_units:
                for file_path in work_unit.files:
                    # Determine target directory
                    if file_path.startswith("api/"):
                        structure["api"].append(file_path)
                    elif file_path.startswith("infra/"):
                        structure["infra"].append(file_path)
                    elif file_path.startswith("shared/"):
                        structure["shared"].append(file_path)
                    else:
                        # Default to dashboard
                        structure["dashboard"].append(file_path)

        # Deduplicate
        for key in structure:
            structure[key] = sorted(set(structure[key]))

        return structure

    def _merge_dependencies(self, modules: list[Module]) -> dict[str, dict[str, str]]:
        """Merge dependencies from all modules.

        Args:
            modules: List of modules.

        Returns:
            Dictionary with npm and python dependencies.
        """
        npm_deps: dict[str, str] = {}
        npm_dev_deps: dict[str, str] = {}
        python_deps: dict[str, str] = {}

        # Map categories to typical dependencies
        dependency_map = {
            "framework": {
                "npm": {"next": "^14.0.0", "react": "^18.2.0", "react-dom": "^18.2.0"},
                "npm_dev": {"typescript": "^5.0.0", "@types/react": "^18.2.0", "@types/node": "^20.0.0"},
            },
            "auth": {
                "npm": {"@clerk/nextjs": "^4.0.0"},
            },
            "payments": {
                "npm": {"stripe": "^14.0.0", "@stripe/stripe-js": "^2.0.0"},
            },
            "storage": {
                "npm": {"@aws-sdk/client-s3": "^3.0.0"},
                "python": {"boto3": "^1.34.0"},
            },
            "ai": {
                "npm": {"@anthropic-ai/sdk": "^0.10.0"},
                "python": {"anthropic": "^0.18.0"},
            },
            "database": {
                "npm": {"@prisma/client": "^5.0.0"},
                "npm_dev": {"prisma": "^5.0.0"},
            },
            "email": {
                "npm": {"resend": "^3.0.0"},
            },
            "analytics": {
                "npm": {"posthog-js": "^1.100.0"},
            },
            "ui": {
                "npm": {
                    "tailwindcss": "^3.4.0",
                    "@radix-ui/react-slot": "^1.0.0",
                    "class-variance-authority": "^0.7.0",
                    "clsx": "^2.0.0",
                    "tailwind-merge": "^2.0.0",
                },
                "npm_dev": {"autoprefixer": "^10.0.0", "postcss": "^8.0.0"},
            },
            "backend": {
                "python": {"fastapi": "^0.109.0", "uvicorn": "^0.27.0", "pydantic": "^2.6.0"},
            },
            "infra": {
                "npm": {"aws-cdk-lib": "^2.0.0", "constructs": "^10.0.0"},
                "npm_dev": {"aws-cdk": "^2.0.0"},
            },
        }

        for module in modules:
            category = module.category.value
            if category in dependency_map:
                deps = dependency_map[category]
                npm_deps.update(deps.get("npm", {}))
                npm_dev_deps.update(deps.get("npm_dev", {}))
                python_deps.update(deps.get("python", {}))

        return {
            "npm": npm_deps,
            "npm_dev": npm_dev_deps,
            "python": python_deps,
        }

    def _generate_files(
        self, modules: list[Module], dependencies: dict[str, dict[str, str]]
    ) -> dict[str, str]:
        """Generate file contents using templates.

        Args:
            modules: List of modules.
            dependencies: Merged dependencies.

        Returns:
            Dictionary mapping file path -> content.
        """
        files: dict[str, str] = {}

        # Generate package.json for dashboard
        if dependencies["npm"] or dependencies["npm_dev"]:
            files["dashboard/package.json"] = self._render_template(
                "dashboard/package.json.j2",
                {
                    "dependencies": dependencies["npm"],
                    "dev_dependencies": dependencies["npm_dev"],
                },
            )

        # Generate pyproject.toml for API
        if dependencies["python"]:
            files["api/pyproject.toml"] = self._render_template(
                "api/pyproject.toml.j2",
                {"dependencies": dependencies["python"]},
            )

        # Generate README
        files["README.md"] = self._render_template(
            "README.md.j2",
            {
                "modules": modules,
                "module_count": len(modules),
            },
        )

        return files

    def _render_template(self, template_name: str, context: dict[str, Any]) -> str:
        """Render a Jinja2 template.

        Args:
            template_name: Template file name.
            context: Template context.

        Returns:
            Rendered template content.
        """
        try:
            template = self.env.get_template(template_name)
            return template.render(**context)
        except Exception:
            # Return placeholder if template not found
            return f"# Generated from {template_name}\n# Context: {context}\n"
