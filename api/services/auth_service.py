"""
Authentication Service

Handles password-based authentication and user management.
"""

import secrets
import hashlib
from typing import Optional

from sqlalchemy.orm import Session

from database.models import User


def generate_api_key() -> str:
    """Generate a secure random API key (used as session token)."""
    return secrets.token_urlsafe(32)


def hash_password(password: str) -> str:
    """Hash a password for storage."""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash."""
    return hash_password(password) == password_hash


class AuthService:
    """Service for authentication operations."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def authenticate(self, email: str, password: str) -> Optional[User]:
        """
        Authenticate a user with email and password.
        Returns the user if credentials are valid, None otherwise.
        """
        user = self.db.query(User).filter(
            User.email == email,
            User.is_active == True,
        ).first()
        
        if user is None:
            return None
        
        if not verify_password(password, user.password_hash):
            return None
        
        # Generate new API key (session token) on each login
        user.api_key = generate_api_key()
        self.db.commit()
        
        return user
    
    def get_user_by_api_key(self, api_key: str) -> Optional[User]:
        """
        Validate an API key (session token) and return the associated user.
        """
        if not api_key:
            return None
        
        return self.db.query(User).filter(
            User.api_key == api_key,
            User.is_active == True,
        ).first()
    
    def create_user(self, email: str, password: str, name: str = None, is_admin: bool = False) -> User:
        """Create a new user with email and password."""
        api_key = generate_api_key()
        
        user = User(
            email=email,
            name=name,
            password_hash=hash_password(password),
            api_key=api_key,
            is_admin=is_admin,
            is_active=True,
        )
        
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        
        return user
    
    def create_admin_if_not_exists(self) -> Optional[User]:
        """
        Create the admin user if it doesn't exist.
        Default admin: admin@compudime.com / 9999
        """
        admin_email = "admin@compudime.com"
        admin_password = "9999"
        
        existing = self.db.query(User).filter(User.email == admin_email).first()
        if existing:
            return existing
        
        return self.create_user(admin_email, admin_password, is_admin=True)
    
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
            password_hash=hash_password("dev123"),
            api_key=dev_api_key,
            is_admin=False,
            is_active=True,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        
        return user
