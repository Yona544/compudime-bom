"""
User Schemas

Pydantic schemas for user management API.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, EmailStr


class LoginRequest(BaseModel):
    """Schema for login request."""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=1, description="User password")


class LoginResponse(BaseModel):
    """Schema for login response."""
    id: int
    email: str
    name: Optional[str] = None
    is_admin: bool
    api_key: str = Field(..., description="Session token for API calls")


class UserCreate(BaseModel):
    """Schema for creating a tenant user (admin only)."""
    email: EmailStr = Field(..., description="Tenant email address")
    name: str = Field(..., min_length=1, description="Business/tenant name")
    password: str = Field(..., min_length=4, description="Tenant password")


class UserResponse(BaseModel):
    """Schema for user response (excludes sensitive data)."""
    id: int
    email: str
    name: Optional[str] = None
    is_admin: bool
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserWithApiKey(UserResponse):
    """User response that includes the API key (only on create)."""
    api_key: str = Field(..., description="Session token for API calls")


class ApiKeyResponse(BaseModel):
    """Response for API key operations."""
    api_key: str = Field(..., description="New API key")
    message: str = "API key regenerated successfully"
