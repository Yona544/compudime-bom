"""
Database Connection and Session Management

Handles database connections, session management, and initialization.
"""

import os
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from .models import Base

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./bom.db")

# Create engine with appropriate configuration
if DATABASE_URL.startswith("sqlite"):
    # SQLite configuration (development/testing)
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
else:
    # PostgreSQL configuration (production)
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
        echo=False,
    )

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Get database session (dependency injection for FastAPI)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_database() -> None:
    """Initialize database by creating all tables."""
    print("Initializing database...")
    try:
        Base.metadata.create_all(bind=engine)
        print("[OK] Database tables created successfully")
    except Exception as e:
        print(f"[ERROR] Error creating database tables: {e}")
        raise


def reset_database() -> None:
    """Reset database by dropping and recreating all tables."""
    print("Resetting database...")
    try:
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        print("[OK] Database reset successfully")
    except Exception as e:
        print(f"[ERROR] Error resetting database: {e}")
        raise
