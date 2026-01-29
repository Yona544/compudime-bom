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
    
    # Serve frontend static files in production (must be BEFORE routers for "/" override)
    frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
    if frontend_dist.exists():
        # Serve assets directory
        app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")
        
        # Serve index.html at root for SPA
        @app.get("/", include_in_schema=False)
        async def serve_spa_root():
            return FileResponse(frontend_dist / "index.html")
    
    # Include API routers
    app.include_router(health_router)
    app.include_router(ingredients_router)
    app.include_router(recipes_router)
    app.include_router(bom_router)
    app.include_router(users_router)
    
    # SPA fallback for client-side routing (must be AFTER routers)
    if frontend_dist.exists():
        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_spa_fallback(request: Request, full_path: str):
            # Don't intercept API routes or docs
            if full_path.startswith("api/") or full_path in ["docs", "redoc", "openapi.json", "health"]:
                # Return 404 - let FastAPI handle it
                from fastapi.responses import JSONResponse
                return JSONResponse({"detail": "Not Found"}, status_code=404)
            # Serve index.html for SPA routing
            return FileResponse(frontend_dist / "index.html")
    
    return app


# Application instance
app = create_app()
