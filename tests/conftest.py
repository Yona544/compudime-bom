"""
Pytest Configuration and Fixtures

Shared fixtures for all tests.
"""

import os
import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

# Set test environment before importing app
os.environ["ENVIRONMENT"] = "development"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["API_KEY"] = "test-api-key"
os.environ["SECRET_KEY"] = "test-secret-key"

from api.app import create_app
from api.config import get_settings


@pytest.fixture(scope="session")
def settings():
    """Get test settings."""
    return get_settings()


@pytest.fixture
def app():
    """Create test FastAPI application."""
    return create_app()


@pytest.fixture
def client(app) -> Generator[TestClient, None, None]:
    """Create test client."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth_headers() -> dict:
    """Headers with valid API key."""
    return {"x-api-key": "test-api-key"}


@pytest.fixture
def test_db_engine():
    """Create in-memory SQLite engine for tests."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    return engine


@pytest.fixture
def test_db_session(test_db_engine) -> Generator[Session, None, None]:
    """Create test database session."""
    # Import here to avoid circular imports
    from database.models import Base
    
    # Create all tables
    Base.metadata.create_all(bind=test_db_engine)
    
    # Create session
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_db_engine)
    session = SessionLocal()
    
    try:
        yield session
    finally:
        session.close()
        # Drop all tables after test
        Base.metadata.drop_all(bind=test_db_engine)
