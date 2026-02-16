"""Dependency resolution for module packs."""

from collections import defaultdict
from dataclasses import dataclass
from enum import Enum


class ModuleCategory(str, Enum):
    """Module category types."""

    FRAMEWORK = "framework"
    AUTH = "auth"
    PAYMENTS = "payments"
    STORAGE = "storage"
    AI = "ai"
    DATABASE = "database"
    EMAIL = "email"
    ANALYTICS = "analytics"
    UI = "ui"
    BACKEND = "backend"
    INFRA = "infra"


@dataclass
class WorkUnit:
    """A single work unit within a module."""

    work_item_id: str
    title: str
    files: list[str]


@dataclass
class Module:
    """A module definition with dependencies and work units."""

    module_id: str
    display_name: str
    description: str
    category: ModuleCategory
    dependencies: list[str]
    work_units: list[WorkUnit]
    tags: list[str]


class CircularDependencyError(Exception):
    """Raised when circular dependencies are detected."""

    def __init__(self, cycle: list[str]) -> None:
        """Initialize with the dependency cycle."""
        self.cycle = cycle
        super().__init__(f"Circular dependency detected: {' -> '.join(cycle)}")


class DependencyResolver:
    """Resolves module dependencies using topological sort."""

    def __init__(self, modules: dict[str, Module]) -> None:
        """Initialize resolver with available modules.

        Args:
            modules: Dictionary of module_id -> Module.
        """
        self.modules = modules

    def resolve_dependencies(self, module_ids: list[str]) -> list[Module]:
        """Resolve dependencies and return modules in topological order.

        Args:
            module_ids: List of module IDs to resolve.

        Returns:
            List of Module objects in dependency order (dependencies first).

        Raises:
            CircularDependencyError: If circular dependencies are detected.
            KeyError: If a module ID is not found.
        """
        if not module_ids:
            return []

        # Collect all required modules including transitive dependencies
        required = self._collect_all_dependencies(module_ids)

        # Build dependency graph
        graph = self._build_dependency_graph(required)

        # Topological sort using Kahn's algorithm
        sorted_ids = self._topological_sort(graph, required)

        return [self.modules[mid] for mid in sorted_ids]

    def _collect_all_dependencies(self, module_ids: list[str]) -> set[str]:
        """Collect all transitive dependencies.

        Args:
            module_ids: Starting module IDs.

        Returns:
            Set of all required module IDs.
        """
        required: set[str] = set()
        to_process = list(module_ids)

        while to_process:
            mid = to_process.pop()
            if mid in required:
                continue

            if mid not in self.modules:
                raise KeyError(f"Module not found: {mid}")

            required.add(mid)
            module = self.modules[mid]
            for dep in module.dependencies:
                if dep not in required:
                    to_process.append(dep)

        return required

    def _build_dependency_graph(
        self, module_ids: set[str]
    ) -> dict[str, list[str]]:
        """Build adjacency list for dependency graph.

        Args:
            module_ids: Set of module IDs to include.

        Returns:
            Dictionary mapping module_id -> list of dependencies.
        """
        graph: dict[str, list[str]] = defaultdict(list)

        for mid in module_ids:
            module = self.modules[mid]
            for dep in module.dependencies:
                if dep in module_ids:
                    graph[mid].append(dep)

        return graph

    def _topological_sort(
        self, graph: dict[str, list[str]], all_nodes: set[str]
    ) -> list[str]:
        """Perform topological sort using Kahn's algorithm.

        Args:
            graph: Dependency graph (node -> dependencies).
            all_nodes: Set of all nodes to include.

        Returns:
            List of module IDs in topological order.

        Raises:
            CircularDependencyError: If circular dependencies exist.
        """
        # Calculate in-degrees (number of modules depending on each)
        in_degree: dict[str, int] = {node: 0 for node in all_nodes}
        reverse_graph: dict[str, list[str]] = defaultdict(list)

        for node, deps in graph.items():
            for dep in deps:
                reverse_graph[dep].append(node)
                in_degree[node] += 1

        # Start with nodes that have no dependencies
        queue = [node for node, degree in in_degree.items() if degree == 0]
        result: list[str] = []

        while queue:
            node = queue.pop(0)
            result.append(node)

            for dependent in reverse_graph[node]:
                in_degree[dependent] -= 1
                if in_degree[dependent] == 0:
                    queue.append(dependent)

        if len(result) != len(all_nodes):
            # Find the cycle
            cycle = self._find_cycle(graph, all_nodes - set(result))
            raise CircularDependencyError(cycle)

        return result

    def _find_cycle(
        self, graph: dict[str, list[str]], nodes: set[str]
    ) -> list[str]:
        """Find a cycle in the remaining nodes.

        Args:
            graph: Dependency graph.
            nodes: Nodes that are part of a cycle.

        Returns:
            List of node IDs forming a cycle.
        """
        # Simple DFS to find a cycle
        visited: set[str] = set()
        path: list[str] = []

        def dfs(node: str) -> list[str] | None:
            if node in visited:
                if node in path:
                    idx = path.index(node)
                    return path[idx:] + [node]
                return None

            visited.add(node)
            path.append(node)

            for dep in graph.get(node, []):
                if dep in nodes:
                    cycle = dfs(dep)
                    if cycle:
                        return cycle

            path.pop()
            return None

        for node in nodes:
            if node not in visited:
                cycle = dfs(node)
                if cycle:
                    return cycle

        return list(nodes)[:3] + [list(nodes)[0]]  # Fallback
