"""
Health Endpoint Tests

TDD tests for health and root endpoints.
"""

import pytest
from fastapi.testclient import TestClient


class TestHealthEndpoint:
    """Tests for /health endpoint."""

    def test_health_returns_200(self, client: TestClient):
        """Health endpoint should return 200 OK."""
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_returns_healthy_status(self, client: TestClient):
        """Health endpoint should return status=healthy."""
        response = client.get("/health")
        data = response.json()
        assert data["status"] == "healthy"

    def test_health_includes_environment(self, client: TestClient):
        """Health endpoint should include environment."""
        response = client.get("/health")
        data = response.json()
        assert "environment" in data

    def test_health_includes_database_status(self, client: TestClient):
        """Health endpoint should include database status."""
        response = client.get("/health")
        data = response.json()
        assert "database" in data


class TestRootEndpoint:
    """Tests for / root endpoint."""

    def test_root_returns_200(self, client: TestClient):
        """Root endpoint should return 200 OK."""
        response = client.get("/")
        assert response.status_code == 200

    def test_root_returns_service_name(self, client: TestClient):
        """Root endpoint should return service name."""
        response = client.get("/")
        data = response.json()
        assert "service" in data
        assert "BOM" in data["service"]

    def test_root_returns_version(self, client: TestClient):
        """Root endpoint should return version."""
        response = client.get("/")
        data = response.json()
        assert "version" in data

    def test_root_returns_status(self, client: TestClient):
        """Root endpoint should return running status."""
        response = client.get("/")
        data = response.json()
        assert data["status"] == "running"

    def test_root_returns_docs_url(self, client: TestClient):
        """Root endpoint should return docs URL."""
        response = client.get("/")
        data = response.json()
        assert data["docs"] == "/docs"


class TestOpenAPI:
    """Tests for OpenAPI/Swagger documentation."""

    def test_openapi_json_accessible(self, client: TestClient):
        """OpenAPI JSON should be accessible."""
        response = client.get("/openapi.json")
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"

    def test_swagger_ui_accessible(self, client: TestClient):
        """Swagger UI should be accessible."""
        response = client.get("/docs")
        assert response.status_code == 200

    def test_redoc_accessible(self, client: TestClient):
        """ReDoc should be accessible."""
        response = client.get("/redoc")
        assert response.status_code == 200
