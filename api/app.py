"""
FastAPI Application

Main application factory and configuration.
"""

import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

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
    
    # Serve frontend static files in production
    frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
    if frontend_dist.exists():
        # Serve assets directory
        app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")
        
        # Serve index.html for all non-API routes (SPA fallback)
        @app.get("/{full_path:path}")
        async def serve_spa(request: Request, full_path: str):
            # Don't intercept API routes
            if full_path.startswith("api/") or full_path in ["docs", "redoc", "openapi.json"]:
                return None
            # Serve index.html for SPA routing
            index_path = frontend_dist / "index.html"
            if index_path.exists():
                return FileResponse(index_path)
            return {"error": "Not found"}
    
    return app


# Application instance
app = create_app()
