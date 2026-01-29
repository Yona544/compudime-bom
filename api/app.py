"""
FastAPI Application

Main application factory and configuration.
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.config import get_settings
from api.routers import health_router, ingredients_router, recipes_router, bom_router, users_router
from database.database import init_database

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan manager."""
    settings = get_settings()
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    logger.info(f"Environment: {settings.environment}")
    
    # Startup
    init_database()
    logger.info("Application started successfully")
    
    yield
    
    # Shutdown
    # TODO: Close database connections
    logger.info("Application shutting down")


def create_app() -> FastAPI:
    """Create and configure FastAPI application."""
    settings = get_settings()
    
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="""
## BOM - Bill of Materials API

Recipe and ingredient cost management for food businesses.

### Features
- **Ingredients**: Manage ingredients with costs, units, and yield percentages
- **Recipes**: Create recipes with ingredients and sub-recipes
- **BOM Generation**: Generate bill of materials for production planning
- **Cost Calculation**: Automatic cost roll-up with unit conversion
        """,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if settings.is_development else [],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include routers
    app.include_router(health_router)
    app.include_router(ingredients_router)
    app.include_router(recipes_router)
    app.include_router(bom_router)
    app.include_router(users_router)
    
    return app


# Application instance
app = create_app()
