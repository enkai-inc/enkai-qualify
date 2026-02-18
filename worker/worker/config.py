"""Worker configuration using pydantic-settings."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Worker settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5432/metis"

    # Anthropic
    anthropic_api_key: str = ""

    # GitHub App
    github_app_id: str = ""
    github_app_installation_id: str = ""
    github_app_private_key: str = ""

    # GitHub repo
    github_repo_owner: str = "tegryan-ddo"
    github_repo_name: str = "metis"

    # Polling
    poll_interval_seconds: int = 60


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
