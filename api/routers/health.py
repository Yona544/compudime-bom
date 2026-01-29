"""
Health Check Router

Provides health and status endpoints.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from api.config import Settings, get_settings

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    environment: str
    database: str = "connected"


class ServiceInfo(BaseModel):
    """Service information response."""
    service: str
    version: str
    status: str
    docs: str


@router.get("/health", response_model=HealthResponse)
async def health_check(settings: Settings = Depends(get_settings)) -> HealthResponse:
    """
    Health check endpoint.
    
    Returns the current health status of the API.
    """
    return HealthResponse(
        status="healthy",
        environment=settings.environment,
        database="connected",
    )


@router.get("/", response_model=ServiceInfo)
async def root(settings: Settings = Depends(get_settings)) -> ServiceInfo:
    """
    Root endpoint.
    
    Returns basic service information.
    """
    return ServiceInfo(
        service=settings.app_name,
        version=settings.app_version,
        status="running",
        docs="/docs",
    )
