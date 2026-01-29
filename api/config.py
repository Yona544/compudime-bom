"""
Application Configuration

Loads settings from environment variables with sensible defaults.
"""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )
    
    # Database
    database_url: str = "sqlite:///./bom.db"
    
    # Security
    secret_key: str = "change-me-in-production"
    api_key: str = "dev-api-key"
    
    # Environment
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = False
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    
    # App info
    app_name: str = "BOM - Bill of Materials"
    app_version: str = "0.1.0"
    
    @property
    def is_production(self) -> bool:
        return self.environment == "production"
    
    @property
    def is_development(self) -> bool:
        return self.environment == "development"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
