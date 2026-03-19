"""GitHub App authentication and issue management via httpx."""

import time
from dataclasses import dataclass

import httpx
import jwt
import structlog

from .config import Settings

logger = structlog.get_logger()

GITHUB_API = "https://api.github.com"
IDEA_GENERATION_LABEL = "enkai:build"
GENERATION_FAILED_LABEL = "enkai-qualify:generation-failed"


@dataclass
class GitHubIssue:
    number: int
    title: str
    body: str
    created_at: str


class GitHubClient:
    """GitHub API client using App authentication."""

    _HTTP_TIMEOUT = httpx.Timeout(30.0, connect=10.0)

    def __init__(self, settings: Settings) -> None:
        self._app_id = settings.github_app_id
        self._installation_id = settings.github_app_installation_id
        self._private_key = settings.github_app_private_key
        self._owner = settings.github_repo_owner
        self._repo = settings.github_repo_name
        self._token: str | None = None
        self._token_expires_at: float = 0

    def _generate_jwt(self) -> str:
        """Generate a JWT for GitHub App authentication."""
        now = int(time.time())
        payload = {
            "iat": now - 60,
            "exp": now + (10 * 60),
            "iss": self._app_id,
        }
        return jwt.encode(payload, self._private_key, algorithm="RS256")

    async def _get_installation_token(self) -> str:
        """Get or refresh the installation access token."""
        if self._token and time.time() < self._token_expires_at - 300:
            return self._token

        app_jwt = self._generate_jwt()
        async with httpx.AsyncClient(timeout=self._HTTP_TIMEOUT) as client:
            resp = await client.post(
                f"{GITHUB_API}/app/installations/{self._installation_id}/access_tokens",
                headers={
                    "Authorization": f"Bearer {app_jwt}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        self._token = data["token"]
        # Installation tokens expire in 1 hour
        self._token_expires_at = time.time() + 3600
        logger.info("github_token_refreshed")
        return self._token

    async def _headers(self) -> dict[str, str]:
        token = await self._get_installation_token()
        return {
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    async def list_pending_issues(self) -> list[GitHubIssue]:
        """List open issues with the idea-generation label."""
        headers = await self._headers()
        async with httpx.AsyncClient(timeout=self._HTTP_TIMEOUT) as client:
            resp = await client.get(
                f"{GITHUB_API}/repos/{self._owner}/{self._repo}/issues",
                headers=headers,
                params={
                    "labels": IDEA_GENERATION_LABEL,
                    "state": "open",
                    "sort": "created",
                    "direction": "asc",
                    "per_page": "30",
                },
            )
            resp.raise_for_status()

        issues = []
        for item in resp.json():
            # Skip pull requests (GitHub API returns them in /issues too)
            if "pull_request" in item:
                continue
            issues.append(
                GitHubIssue(
                    number=item["number"],
                    title=item["title"],
                    body=item.get("body", ""),
                    created_at=item["created_at"],
                )
            )
        return issues

    async def close_issue(self, number: int, comment: str) -> None:
        """Add a comment and close an issue."""
        headers = await self._headers()
        async with httpx.AsyncClient(timeout=self._HTTP_TIMEOUT) as client:
            # Add comment
            resp = await client.post(
                f"{GITHUB_API}/repos/{self._owner}/{self._repo}/issues/{number}/comments",
                headers=headers,
                json={"body": comment},
            )
            resp.raise_for_status()
            # Close issue
            resp = await client.patch(
                f"{GITHUB_API}/repos/{self._owner}/{self._repo}/issues/{number}",
                headers=headers,
                json={"state": "closed"},
            )
            resp.raise_for_status()
        logger.info("issue_closed", number=number)

    async def add_comment(self, number: int, body: str) -> None:
        """Add a comment to an issue."""
        headers = await self._headers()
        async with httpx.AsyncClient(timeout=self._HTTP_TIMEOUT) as client:
            resp = await client.post(
                f"{GITHUB_API}/repos/{self._owner}/{self._repo}/issues/{number}/comments",
                headers=headers,
                json={"body": body},
            )
            resp.raise_for_status()

    async def add_label(self, number: int, label: str) -> None:
        """Add a label to an issue."""
        headers = await self._headers()
        async with httpx.AsyncClient(timeout=self._HTTP_TIMEOUT) as client:
            resp = await client.post(
                f"{GITHUB_API}/repos/{self._owner}/{self._repo}/issues/{number}/labels",
                headers=headers,
                json={"labels": [label]},
            )
            resp.raise_for_status()
