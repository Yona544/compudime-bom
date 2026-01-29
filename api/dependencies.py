"""
API Dependencies

Dependency injection for FastAPI routes.
"""

from fastapi import Depends, HTTPException, Header, status
from sqlalchemy.orm import Session

from api.config import get_settings, Settings
from database.database import get_db
from api.services.auth_service import AuthService


async def get_current_user_id(
    x_api_key: str = Header(..., description="API key for authentication"),
    settings: Settings = Depends(get_settings),
    db: Session = Depends(get_db),
) -> int:
    """
    Validate API key and return user ID.
    
    In development mode with the configured dev API key, creates/returns dev user.
    In production, validates against the database.
    """
    auth_service = AuthService(db)
    
    # Development mode: create dev user if using dev API key
    if settings.is_development and x_api_key == settings.api_key:
        user = auth_service.get_or_create_dev_user(x_api_key)
        return user.id
    
    # Normal auth: look up API key in database
    user = auth_service.get_user_by_api_key(x_api_key)
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    
    return user.id
