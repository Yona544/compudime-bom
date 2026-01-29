"""
Users Router

API endpoints for user management.
Note: These endpoints require admin access in production.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database.database import get_db
from database.models import User
from api.schemas.user import UserCreate, UserResponse, UserWithApiKey, ApiKeyResponse
from api.services.auth_service import AuthService
from api.dependencies import get_current_user_id

router = APIRouter(prefix="/api/v1/users", tags=["Users"])


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    """Dependency to get auth service."""
    return AuthService(db)


@router.post("", response_model=UserWithApiKey, status_code=status.HTTP_201_CREATED)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    auth_service: AuthService = Depends(get_auth_service),
):
    """
    Create a new user.
    
    Returns the user with their API key. Save the API key - it won't be shown again.
    
    Note: In production, this should require admin authentication.
    """
    # Check if email already exists
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    user = auth_service.create_user(data.email)
    
    return UserWithApiKey(
        id=user.id,
        email=user.email,
        is_active=user.is_active,
        created_at=user.created_at,
        api_key=user.api_key,
    )


@router.get("/me", response_model=UserResponse)
def get_current_user(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    Get the current authenticated user.
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return UserResponse.model_validate(user)


@router.post("/me/regenerate-key", response_model=ApiKeyResponse)
def regenerate_api_key(
    user_id: int = Depends(get_current_user_id),
    auth_service: AuthService = Depends(get_auth_service),
):
    """
    Regenerate the API key for the current user.
    
    The old key will stop working immediately.
    Save the new key - it won't be shown again.
    """
    new_key = auth_service.regenerate_api_key(user_id)
    
    if new_key is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return ApiKeyResponse(api_key=new_key)
