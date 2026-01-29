"""
Authentication Tests

TDD tests for authentication and user management.
"""

import pytest
from fastapi.testclient import TestClient


class TestUserCreation:
    """Tests for POST /api/v1/users."""

    def test_create_user_returns_201(self, client: TestClient):
        """Creating a user should return 201."""
        response = client.post(
            "/api/v1/users",
            json={"email": "newuser@example.com"},
        )
        assert response.status_code == 201

    def test_create_user_returns_api_key(self, client: TestClient):
        """Created user should have an API key."""
        response = client.post(
            "/api/v1/users",
            json={"email": "keyuser@example.com"},
        )
        data = response.json()
        assert "api_key" in data
        assert len(data["api_key"]) > 20  # Should be a substantial key

    def test_create_user_duplicate_email_fails(self, client: TestClient):
        """Duplicate email should return 400."""
        email = "duplicate@example.com"
        
        # First creation should succeed
        client.post("/api/v1/users", json={"email": email})
        
        # Second creation should fail
        response = client.post("/api/v1/users", json={"email": email})
        assert response.status_code == 400

    def test_create_user_invalid_email_fails(self, client: TestClient):
        """Invalid email should return 422."""
        response = client.post(
            "/api/v1/users",
            json={"email": "not-an-email"},
        )
        assert response.status_code == 422


class TestUserApiKey:
    """Tests for API key authentication."""

    def test_new_user_can_authenticate(self, client: TestClient):
        """Newly created user should be able to authenticate."""
        # Create user
        create_response = client.post(
            "/api/v1/users",
            json={"email": "authtest@example.com"},
        )
        api_key = create_response.json()["api_key"]
        
        # Use the key to access protected endpoint
        response = client.get(
            "/api/v1/users/me",
            headers={"x-api-key": api_key},
        )
        assert response.status_code == 200
        assert response.json()["email"] == "authtest@example.com"

    def test_invalid_api_key_returns_401(self, client: TestClient):
        """Invalid API key should return 401."""
        response = client.get(
            "/api/v1/users/me",
            headers={"x-api-key": "invalid-key-12345"},
        )
        assert response.status_code == 401

    def test_missing_api_key_returns_422(self, client: TestClient):
        """Missing API key should return 422 (validation error)."""
        response = client.get("/api/v1/users/me")
        assert response.status_code == 422


class TestRegenerateApiKey:
    """Tests for POST /api/v1/users/me/regenerate-key."""

    def test_regenerate_key_returns_new_key(self, client: TestClient):
        """Regenerating should return a new API key."""
        # Create user
        create_response = client.post(
            "/api/v1/users",
            json={"email": "regen@example.com"},
        )
        old_key = create_response.json()["api_key"]
        
        # Regenerate
        regen_response = client.post(
            "/api/v1/users/me/regenerate-key",
            headers={"x-api-key": old_key},
        )
        assert regen_response.status_code == 200
        new_key = regen_response.json()["api_key"]
        
        # Keys should be different
        assert new_key != old_key

    def test_old_key_stops_working_after_regenerate(self, client: TestClient):
        """Old key should not work after regeneration."""
        # Create user
        create_response = client.post(
            "/api/v1/users",
            json={"email": "oldkey@example.com"},
        )
        old_key = create_response.json()["api_key"]
        
        # Regenerate
        client.post(
            "/api/v1/users/me/regenerate-key",
            headers={"x-api-key": old_key},
        )
        
        # Old key should not work
        response = client.get(
            "/api/v1/users/me",
            headers={"x-api-key": old_key},
        )
        assert response.status_code == 401

    def test_new_key_works_after_regenerate(self, client: TestClient):
        """New key should work after regeneration."""
        # Create user
        create_response = client.post(
            "/api/v1/users",
            json={"email": "newkey@example.com"},
        )
        old_key = create_response.json()["api_key"]
        
        # Regenerate
        regen_response = client.post(
            "/api/v1/users/me/regenerate-key",
            headers={"x-api-key": old_key},
        )
        new_key = regen_response.json()["api_key"]
        
        # New key should work
        response = client.get(
            "/api/v1/users/me",
            headers={"x-api-key": new_key},
        )
        assert response.status_code == 200


class TestGetCurrentUser:
    """Tests for GET /api/v1/users/me."""

    def test_get_current_user_returns_user_data(self, client: TestClient):
        """Should return current user's data."""
        # Create user
        create_response = client.post(
            "/api/v1/users",
            json={"email": "getme@example.com"},
        )
        api_key = create_response.json()["api_key"]
        user_id = create_response.json()["id"]
        
        # Get current user
        response = client.get(
            "/api/v1/users/me",
            headers={"x-api-key": api_key},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == user_id
        assert data["email"] == "getme@example.com"
        assert "api_key" not in data  # Should not expose API key
