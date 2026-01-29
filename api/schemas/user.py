"""
User Schemas

Pydantic schemas for user management API.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, EmailStr


class UserCreate(BaseModel):
    """Schema for creating a user."""
    email: EmailStr = Field(..., description="User email address")


class UserResponse(BaseModel):
    """Schema for user response (excludes sensitive data)."""
    id: int
    email: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserWithApiKey(UserResponse):
    """User response that includes the API key (only on create/regenerate)."""
    api_key: str = Field(..., description="API key - save this, it won't be shown again")


class ApiKeyResponse(BaseModel):
    """Response for API key operations."""
    api_key: str = Field(..., description="New API key - save this, it won't be shown again")
    message: str = "API key regenerated successfully"
