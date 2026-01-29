"""
Authentication Service

Handles API key validation and user authentication.
"""

import secrets
import hashlib
from typing import Optional

from sqlalchemy.orm import Session

from database.models import User


def generate_api_key() -> str:
    """Generate a secure random API key."""
    return secrets.token_urlsafe(32)


def hash_api_key(api_key: str) -> str:
    """Hash an API key for storage."""
    return hashlib.sha256(api_key.encode()).hexdigest()


class AuthService:
    """Service for authentication operations."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_user_by_api_key(self, api_key: str) -> Optional[User]:
        """
        Validate an API key and return the associated user.
        
        Note: In production, you'd want to hash the API key and compare hashes.
        For simplicity, we're storing and comparing plain API keys.
        """
        if not api_key:
            return None
        
        return self.db.query(User).filter(
            User.api_key == api_key,
            User.is_active == True,
        ).first()
    
    def create_user(self, email: str, password_hash: str = "not-used") -> User:
        """Create a new user with an API key."""
        api_key = generate_api_key()
        
        user = User(
            email=email,
            password_hash=password_hash,
            api_key=api_key,
            is_active=True,
        )
        
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        
        return user
    
    def regenerate_api_key(self, user_id: int) -> Optional[str]:
        """Regenerate API key for a user. Returns the new key."""
        user = self.db.query(User).filter(User.id == user_id).first()
        
        if user is None:
            return None
        
        new_key = generate_api_key()
        user.api_key = new_key
        
        self.db.commit()
        
        return new_key
    
    def get_or_create_dev_user(self, dev_api_key: str) -> User:
        """
        Get or create a development user with a specific API key.
        Used for local development and testing.
        """
        # Check if user exists with this key
        user = self.get_user_by_api_key(dev_api_key)
        if user:
            return user
        
        # Check if dev user exists by email
        user = self.db.query(User).filter(User.email == "dev@bom.local").first()
        if user:
            # Update API key
            user.api_key = dev_api_key
            self.db.commit()
            return user
        
        # Create new dev user
        user = User(
            email="dev@bom.local",
            password_hash="dev-not-used",
            api_key=dev_api_key,
            is_active=True,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        
        return user
