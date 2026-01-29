"""
Ingredients API Tests

TDD tests for ingredient CRUD endpoints.
"""

import pytest
from decimal import Decimal
from fastapi.testclient import TestClient


# Test data
VALID_INGREDIENT = {
    "name": "All-Purpose Flour",
    "description": "Standard baking flour",
    "purchase_unit": "bag",
    "purchase_qty": "5",  # 5 lb bag
    "purchase_price": "4.99",
    "recipe_unit": "cup",
    "conversion_factor": "18.5",  # ~18.5 cups per 5lb bag
    "yield_percent": "100",
}


class TestCreateIngredient:
    """Tests for POST /api/v1/ingredients."""

    def test_create_ingredient_returns_201(self, client: TestClient, auth_headers: dict):
        """Creating an ingredient should return 201."""
        response = client.post(
            "/api/v1/ingredients",
            json=VALID_INGREDIENT,
            headers=auth_headers,
        )
        assert response.status_code == 201

    def test_create_ingredient_returns_id(self, client: TestClient, auth_headers: dict):
        """Created ingredient should have an ID."""
        response = client.post(
            "/api/v1/ingredients",
            json=VALID_INGREDIENT,
            headers=auth_headers,
        )
        data = response.json()
        assert "id" in data
        assert isinstance(data["id"], int)

    def test_create_ingredient_returns_unit_cost(self, client: TestClient, auth_headers: dict):
        """Created ingredient should include calculated unit cost."""
        response = client.post(
            "/api/v1/ingredients",
            json=VALID_INGREDIENT,
            headers=auth_headers,
        )
        data = response.json()
        assert "unit_cost" in data
        # $4.99 / 18.5 cups ≈ $0.27/cup
        assert data["unit_cost"] is not None

    def test_create_ingredient_validates_required_fields(self, client: TestClient, auth_headers: dict):
        """Missing required fields should return 422."""
        response = client.post(
            "/api/v1/ingredients",
            json={"name": "Incomplete"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_create_ingredient_validates_positive_qty(self, client: TestClient, auth_headers: dict):
        """Purchase qty must be positive."""
        invalid = {**VALID_INGREDIENT, "purchase_qty": "0"}
        response = client.post(
            "/api/v1/ingredients",
            json=invalid,
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_create_ingredient_requires_auth(self, client: TestClient):
        """Creating without auth should return 401/422."""
        response = client.post(
            "/api/v1/ingredients",
            json=VALID_INGREDIENT,
        )
        assert response.status_code in [401, 422]


class TestListIngredients:
    """Tests for GET /api/v1/ingredients."""

    def test_list_ingredients_returns_200(self, client: TestClient, auth_headers: dict):
        """Listing ingredients should return 200."""
        response = client.get("/api/v1/ingredients", headers=auth_headers)
        assert response.status_code == 200

    def test_list_ingredients_returns_paginated(self, client: TestClient, auth_headers: dict):
        """List should return paginated response."""
        response = client.get("/api/v1/ingredients", headers=auth_headers)
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "offset" in data
        assert "limit" in data

    def test_list_ingredients_pagination(self, client: TestClient, auth_headers: dict):
        """Pagination parameters should work."""
        # Create some ingredients first
        for i in range(5):
            client.post(
                "/api/v1/ingredients",
                json={**VALID_INGREDIENT, "name": f"Ingredient {i}"},
                headers=auth_headers,
            )
        
        # Get with pagination
        response = client.get(
            "/api/v1/ingredients?offset=2&limit=2",
            headers=auth_headers,
        )
        data = response.json()
        assert len(data["items"]) <= 2
        assert data["offset"] == 2
        assert data["limit"] == 2

    def test_list_ingredients_search(self, client: TestClient, auth_headers: dict):
        """Search parameter should filter results."""
        # Create ingredients
        client.post(
            "/api/v1/ingredients",
            json={**VALID_INGREDIENT, "name": "Sugar"},
            headers=auth_headers,
        )
        client.post(
            "/api/v1/ingredients",
            json={**VALID_INGREDIENT, "name": "Brown Sugar"},
            headers=auth_headers,
        )
        client.post(
            "/api/v1/ingredients",
            json={**VALID_INGREDIENT, "name": "Salt"},
            headers=auth_headers,
        )
        
        # Search for sugar
        response = client.get(
            "/api/v1/ingredients?search=sugar",
            headers=auth_headers,
        )
        data = response.json()
        # Should find "Sugar" and "Brown Sugar"
        for item in data["items"]:
            assert "sugar" in item["name"].lower()


class TestGetIngredient:
    """Tests for GET /api/v1/ingredients/{id}."""

    def test_get_ingredient_returns_200(self, client: TestClient, auth_headers: dict):
        """Getting an ingredient should return 200."""
        # Create first
        create_response = client.post(
            "/api/v1/ingredients",
            json=VALID_INGREDIENT,
            headers=auth_headers,
        )
        ingredient_id = create_response.json()["id"]
        
        # Get it
        response = client.get(
            f"/api/v1/ingredients/{ingredient_id}",
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_get_ingredient_returns_data(self, client: TestClient, auth_headers: dict):
        """Get should return the ingredient data."""
        create_response = client.post(
            "/api/v1/ingredients",
            json=VALID_INGREDIENT,
            headers=auth_headers,
        )
        ingredient_id = create_response.json()["id"]
        
        response = client.get(
            f"/api/v1/ingredients/{ingredient_id}",
            headers=auth_headers,
        )
        data = response.json()
        assert data["name"] == VALID_INGREDIENT["name"]
        assert data["purchase_unit"] == VALID_INGREDIENT["purchase_unit"]

    def test_get_ingredient_not_found_returns_404(self, client: TestClient, auth_headers: dict):
        """Getting non-existent ingredient should return 404."""
        response = client.get(
            "/api/v1/ingredients/99999",
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestUpdateIngredient:
    """Tests for PATCH /api/v1/ingredients/{id}."""

    def test_update_ingredient_returns_200(self, client: TestClient, auth_headers: dict):
        """Updating an ingredient should return 200."""
        # Create first
        create_response = client.post(
            "/api/v1/ingredients",
            json=VALID_INGREDIENT,
            headers=auth_headers,
        )
        ingredient_id = create_response.json()["id"]
        
        # Update it
        response = client.patch(
            f"/api/v1/ingredients/{ingredient_id}",
            json={"name": "Updated Name"},
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_update_ingredient_partial(self, client: TestClient, auth_headers: dict):
        """Partial update should only change specified fields."""
        create_response = client.post(
            "/api/v1/ingredients",
            json=VALID_INGREDIENT,
            headers=auth_headers,
        )
        ingredient_id = create_response.json()["id"]
        
        # Update only name
        response = client.patch(
            f"/api/v1/ingredients/{ingredient_id}",
            json={"name": "New Name"},
            headers=auth_headers,
        )
        data = response.json()
        assert data["name"] == "New Name"
        assert data["purchase_unit"] == VALID_INGREDIENT["purchase_unit"]  # Unchanged

    def test_update_ingredient_not_found_returns_404(self, client: TestClient, auth_headers: dict):
        """Updating non-existent ingredient should return 404."""
        response = client.patch(
            "/api/v1/ingredients/99999",
            json={"name": "Updated"},
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestDeleteIngredient:
    """Tests for DELETE /api/v1/ingredients/{id}."""

    def test_delete_ingredient_returns_204(self, client: TestClient, auth_headers: dict):
        """Deleting an ingredient should return 204."""
        # Create first
        create_response = client.post(
            "/api/v1/ingredients",
            json=VALID_INGREDIENT,
            headers=auth_headers,
        )
        ingredient_id = create_response.json()["id"]
        
        # Delete it
        response = client.delete(
            f"/api/v1/ingredients/{ingredient_id}",
            headers=auth_headers,
        )
        assert response.status_code == 204

    def test_delete_ingredient_removes_from_list(self, client: TestClient, auth_headers: dict):
        """Deleted ingredient should not appear in list."""
        # Create
        create_response = client.post(
            "/api/v1/ingredients",
            json={**VALID_INGREDIENT, "name": "To Be Deleted"},
            headers=auth_headers,
        )
        ingredient_id = create_response.json()["id"]
        
        # Delete
        client.delete(
            f"/api/v1/ingredients/{ingredient_id}",
            headers=auth_headers,
        )
        
        # Try to get
        response = client.get(
            f"/api/v1/ingredients/{ingredient_id}",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_delete_ingredient_not_found_returns_404(self, client: TestClient, auth_headers: dict):
        """Deleting non-existent ingredient should return 404."""
        response = client.delete(
            "/api/v1/ingredients/99999",
            headers=auth_headers,
        )
        assert response.status_code == 404


class TestIngredientIsolation:
    """Tests for multi-tenant data isolation."""

    def test_user_can_see_own_ingredients(self, client: TestClient):
        """Users should see their own ingredients."""
        import uuid
        unique_name = f"Unique Ingredient {uuid.uuid4().hex[:8]}"
        
        # Create with user 1 (test-api-key)
        create_response = client.post(
            "/api/v1/ingredients",
            json={**VALID_INGREDIENT, "name": unique_name},
            headers={"x-api-key": "test-api-key"},
        )
        assert create_response.status_code == 201
        created_id = create_response.json()["id"]
        
        # List with same user should see it
        response = client.get(
            f"/api/v1/ingredients/{created_id}",
            headers={"x-api-key": "test-api-key"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == unique_name
