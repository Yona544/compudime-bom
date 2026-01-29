"""
Users Router

API endpoints for user authentication and management.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database.database import get_db
from database.models import User
from api.schemas.user import (
    LoginRequest, LoginResponse, UserCreate, UserResponse, 
    UserWithApiKey, ApiKeyResponse
)
from api.services.auth_service import AuthService
from api.dependencies import get_current_user_id

router = APIRouter(prefix="/api/v1/users", tags=["Users"])


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    """Dependency to get auth service."""
    return AuthService(db)


@router.post("/login", response_model=LoginResponse)
def login(
    data: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service),
):
    """
    Login with email and password.
    
    Returns a session token (api_key) for subsequent API calls.
    """
    user = auth_service.authenticate(data.email, data.password)
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    
    return LoginResponse(
        id=user.id,
        email=user.email,
        is_admin=user.is_admin,
        api_key=user.api_key,
    )


@router.post("", response_model=UserWithApiKey, status_code=status.HTTP_201_CREATED)
def create_tenant(
    data: UserCreate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
    auth_service: AuthService = Depends(get_auth_service),
):
    """
    Create a new tenant user. (Admin only)
    
    Used by Compudime IT during customer onboarding.
    """
    # Check if current user is admin
    current_user = db.query(User).filter(User.id == user_id).first()
    if not current_user or not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    
    # Check if email already exists
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    user = auth_service.create_user(data.email, data.password, data.name)
    
    return UserWithApiKey(
        id=user.id,
        email=user.email,
        name=user.name,
        is_admin=user.is_admin,
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


@router.get("", response_model=list[UserResponse])
def list_tenants(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """
    List all tenant users. (Admin only)
    """
    current_user = db.query(User).filter(User.id == user_id).first()
    if not current_user or not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    
    users = db.query(User).filter(User.is_admin == False).all()
    return [UserResponse.model_validate(u) for u in users]


@router.post("/me/regenerate-key", response_model=ApiKeyResponse)
def regenerate_api_key(
    user_id: int = Depends(get_current_user_id),
    auth_service: AuthService = Depends(get_auth_service),
):
    """
    Regenerate the session token for the current user.
    """
    new_key = auth_service.regenerate_api_key(user_id)
    
    if new_key is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return ApiKeyResponse(api_key=new_key)
