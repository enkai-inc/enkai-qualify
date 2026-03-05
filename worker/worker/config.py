"""Worker configuration using pydantic-settings."""

from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Worker settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Environment
    environment: str = "development"

    # Database
    database_url: str = ""

    # Anthropic
    anthropic_api_key: str = ""

    # GitHub App
    github_app_id: str = ""
    github_app_installation_id: str = ""
    github_app_private_key: str = ""

    # GitHub repo
    github_repo_owner: str = "enkai-inc"
    github_repo_name: str = "enkai-qualify"

    # Polling
    poll_interval_seconds: int = 60

    @model_validator(mode="after")
    def validate_required_secrets(self) -> "Settings":
        """Validate that required secrets are set in non-development environments."""
        if self.environment == "development":
            return self
        missing = []
        if not self.anthropic_api_key:
            missing.append("anthropic_api_key")
        if not self.github_app_id:
            missing.append("github_app_id")
        if not self.github_app_private_key:
            missing.append("github_app_private_key")
        if not self.database_url:
            missing.append("database_url")
        if missing:
            raise ValueError(
                f"Required settings must be non-empty in "
                f"non-development environments: {', '.join(missing)}"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
