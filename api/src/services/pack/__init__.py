"""Pack assembler service for creating Enkai-compatible zip bundles."""

from .assembler import PackAssembler, PackConfig, PackResult
from .issues import GeneratedIssue, IssueGenerator
from .resolver import (
    CircularDependencyError,
    DependencyResolver,
    Module,
    ModuleCategory,
    WorkUnit,
)
from .scaffold import ScaffoldGenerator
from .storage import PackStorage, PackStorageError

__all__ = [
    # Main assembler
    "PackAssembler",
    "PackConfig",
    "PackResult",
    # Dependency resolution
    "DependencyResolver",
    "CircularDependencyError",
    "Module",
    "ModuleCategory",
    "WorkUnit",
    # Scaffold generation
    "ScaffoldGenerator",
    # Issue generation
    "IssueGenerator",
    "GeneratedIssue",
    # Storage
    "PackStorage",
    "PackStorageError",
]
