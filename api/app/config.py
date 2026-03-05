"""Application configuration using pydantic-settings."""

from functools import lru_cache
from typing import List

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    version: str = "0.1.0"
    debug: bool = False
    environment: str = "production"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # CORS
    cors_origins: List[str] = ["http://localhost:3000"]

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/enkai_qualify"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # AWS
    aws_region: str = "us-east-1"

    # Authentication
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 30

    @model_validator(mode="after")
    def validate_secret_key(self) -> "Settings":
        dev_environments = {"development", "dev", "local", "test"}
        if self.environment not in dev_environments and self.secret_key == "change-me-in-production":
            raise ValueError(
                "secret_key must be changed from its default value "
                "in non-development environments"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
