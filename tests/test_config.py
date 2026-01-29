"""
Configuration Tests

TDD tests for application configuration.
"""

import os
import pytest


class TestSettings:
    """Tests for Settings configuration."""

    def test_settings_loads_defaults(self):
        """Settings should load with defaults."""
        from api.config import Settings
        settings = Settings()
        assert settings.app_name == "BOM - Bill of Materials"
        assert settings.app_version == "0.1.0"

    def test_settings_loads_from_env(self, monkeypatch):
        """Settings should load from environment variables."""
        monkeypatch.setenv("DATABASE_URL", "postgresql://test:test@localhost/test")
        monkeypatch.setenv("SECRET_KEY", "my-secret")
        
        from api.config import Settings
        settings = Settings()
        assert settings.database_url == "postgresql://test:test@localhost/test"
        assert settings.secret_key == "my-secret"

    def test_is_production_flag(self):
        """is_production should return True only in production."""
        from api.config import Settings
        
        dev_settings = Settings(environment="development")
        assert dev_settings.is_production is False
        assert dev_settings.is_development is True
        
        prod_settings = Settings(environment="production")
        assert prod_settings.is_production is True
        assert prod_settings.is_development is False

    def test_get_settings_cached(self):
        """get_settings should return cached instance."""
        from api.config import get_settings
        
        settings1 = get_settings()
        settings2 = get_settings()
        assert settings1 is settings2
