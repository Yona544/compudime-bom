"""
BOM API Tests

TDD tests for Bill of Materials endpoints.
"""

import pytest
from decimal import Decimal
from datetime import date
from fastapi.testclient import TestClient


# Test data
VALID_INGREDIENT = {
    "name": "Flour",
    "purchase_unit": "bag",
    "purchase_qty": "5",
    "purchase_price": "4.99",
    "recipe_unit": "cup",
    "conversion_factor": "18.5",
    "yield_percent": "100",
}

VALID_INGREDIENT_2 = {
    "name": "Sugar",
    "purchase_unit": "bag",
    "purchase_qty": "4",
    "purchase_price": "3.99",
    "recipe_unit": "cup",
    "conversion_factor": "8",
    "yield_percent": "100",
}


def create_ingredient(client: TestClient, auth_headers: dict, data: dict = None) -> int:
    """Helper to create an ingredient."""
    data = data or VALID_INGREDIENT
    response = client.post("/api/v1/ingredients", json=data, headers=auth_headers)
    return response.json()["id"]


def create_recipe(client: TestClient, auth_headers: dict, name: str, yield_qty: str, items: list) -> int:
    """Helper to create a recipe."""
    response = client.post(
        "/api/v1/recipes",
        json={"name": name, "yield_qty": yield_qty, "items": items},
        headers=auth_headers,
    )
    return response.json()["id"]


class TestGenerateBOM:
    """Tests for POST /api/v1/bom/generate."""

    def test_generate_bom_returns_201(self, client: TestClient, auth_headers: dict):
        """Generating a BOM should return 201."""
        ing_id = create_ingredient(client, auth_headers)
        recipe_id = create_recipe(
            client, auth_headers, "Test Recipe", "4",
            [{"ingredient_id": ing_id, "quantity": "2", "unit": "cup"}]
        )
        
        response = client.post(
            "/api/v1/bom/generate",
            json={
                "name": "Test BOM",
                "date": "2026-01-29",
                "recipes": [{"recipe_id": recipe_id, "portions": "8"}],
            },
            headers=auth_headers,
        )
        assert response.status_code == 201

    def test_generate_bom_returns_id(self, client: TestClient, auth_headers: dict):
        """Generated BOM should have an ID."""
        ing_id = create_ingredient(client, auth_headers)
        recipe_id = create_recipe(
            client, auth_headers, "Test Recipe", "4",
            [{"ingredient_id": ing_id, "quantity": "2", "unit": "cup"}]
        )
        
        response = client.post(
            "/api/v1/bom/generate",
            json={
                "name": "ID Test BOM",
                "date": "2026-01-29",
                "recipes": [{"recipe_id": recipe_id, "portions": "4"}],
            },
            headers=auth_headers,
        )
        data = response.json()
        assert "id" in data
        assert isinstance(data["id"], int)

    def test_generate_bom_aggregates_ingredients(self, client: TestClient, auth_headers: dict):
        """BOM should aggregate ingredients from multiple recipes."""
        flour_id = create_ingredient(client, auth_headers, VALID_INGREDIENT)
        sugar_id = create_ingredient(client, auth_headers, VALID_INGREDIENT_2)
        
        # Recipe 1: uses 2 cups flour
        recipe1_id = create_recipe(
            client, auth_headers, "Recipe 1", "4",
            [{"ingredient_id": flour_id, "quantity": "2", "unit": "cup"}]
        )
        
        # Recipe 2: uses 1 cup flour and 1 cup sugar
        recipe2_id = create_recipe(
            client, auth_headers, "Recipe 2", "4",
            [
                {"ingredient_id": flour_id, "quantity": "1", "unit": "cup"},
                {"ingredient_id": sugar_id, "quantity": "1", "unit": "cup"},
            ]
        )
        
        # Generate BOM for both recipes at 1x scale
        response = client.post(
            "/api/v1/bom/generate",
            json={
                "name": "Multi-Recipe BOM",
                "date": "2026-01-29",
                "recipes": [
                    {"recipe_id": recipe1_id, "portions": "4"},
                    {"recipe_id": recipe2_id, "portions": "4"},
                ],
            },
            headers=auth_headers,
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Should have 2 ingredients
        assert len(data["ingredients"]) == 2
        
        # Find flour - should be 3 cups total (2 + 1)
        flour_line = next(i for i in data["ingredients"] if i["ingredient_name"] == "Flour")
        assert Decimal(flour_line["total_qty"]) == Decimal("3")

    def test_generate_bom_scales_quantities(self, client: TestClient, auth_headers: dict):
        """BOM should scale ingredient quantities based on portions."""
        ing_id = create_ingredient(client, auth_headers)
        
        # Recipe yields 4 portions, uses 2 cups
        recipe_id = create_recipe(
            client, auth_headers, "Scalable", "4",
            [{"ingredient_id": ing_id, "quantity": "2", "unit": "cup"}]
        )
        
        # Generate BOM for 8 portions (2x scale)
        response = client.post(
            "/api/v1/bom/generate",
            json={
                "name": "Scaled BOM",
                "date": "2026-01-29",
                "recipes": [{"recipe_id": recipe_id, "portions": "8"}],
            },
            headers=auth_headers,
        )
        
        data = response.json()
        # Should be 4 cups (2 cups * 2x scale)
        assert Decimal(data["ingredients"][0]["total_qty"]) == Decimal("4")

    def test_generate_bom_calculates_costs(self, client: TestClient, auth_headers: dict):
        """BOM should calculate total cost."""
        ing_id = create_ingredient(client, auth_headers)
        recipe_id = create_recipe(
            client, auth_headers, "Costed Recipe", "4",
            [{"ingredient_id": ing_id, "quantity": "2", "unit": "cup"}]
        )
        
        response = client.post(
            "/api/v1/bom/generate",
            json={
                "name": "Costed BOM",
                "date": "2026-01-29",
                "recipes": [{"recipe_id": recipe_id, "portions": "4"}],
            },
            headers=auth_headers,
        )
        
        data = response.json()
        assert data["total_cost"] is not None
        assert Decimal(data["total_cost"]) > 0

    def test_generate_bom_validates_recipe_exists(self, client: TestClient, auth_headers: dict):
        """Non-existent recipe should return 400."""
        response = client.post(
            "/api/v1/bom/generate",
            json={
                "name": "Bad BOM",
                "date": "2026-01-29",
                "recipes": [{"recipe_id": 99999, "portions": "4"}],
            },
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_generate_bom_requires_at_least_one_recipe(self, client: TestClient, auth_headers: dict):
        """BOM must have at least one recipe."""
        response = client.post(
            "/api/v1/bom/generate",
            json={
                "name": "Empty BOM",
                "date": "2026-01-29",
                "recipes": [],
            },
            headers=auth_headers,
        )
        assert response.status_code == 422


class TestBOMWithSubRecipes:
    """Tests for BOM generation with sub-recipes."""

    def test_bom_flattens_subrecipes(self, client: TestClient, auth_headers: dict):
        """BOM should flatten sub-recipes to their ingredients."""
        flour_id = create_ingredient(client, auth_headers, VALID_INGREDIENT)
        sugar_id = create_ingredient(client, auth_headers, VALID_INGREDIENT_2)
        
        # Create sauce (sub-recipe)
        sauce_id = create_recipe(
            client, auth_headers, "Sauce", "2",
            [{"ingredient_id": flour_id, "quantity": "1", "unit": "cup"}]
        )
        
        # Create main recipe using sauce as sub-recipe
        main_id = create_recipe(
            client, auth_headers, "Main Dish", "4",
            [
                {"sub_recipe_id": sauce_id, "quantity": "2", "unit": "portion"},  # 1 batch of sauce
                {"ingredient_id": sugar_id, "quantity": "2", "unit": "cup"},
            ]
        )
        
        response = client.post(
            "/api/v1/bom/generate",
            json={
                "name": "Nested BOM",
                "date": "2026-01-29",
                "recipes": [{"recipe_id": main_id, "portions": "4"}],
            },
            headers=auth_headers,
        )
        
        assert response.status_code == 201
        data = response.json()
        
        # Should have flour (from sauce) and sugar
        assert len(data["ingredients"]) == 2
        
        ingredient_names = [i["ingredient_name"] for i in data["ingredients"]]
        assert "Flour" in ingredient_names
        assert "Sugar" in ingredient_names


class TestListBOMs:
    """Tests for GET /api/v1/bom."""

    def test_list_boms_returns_200(self, client: TestClient, auth_headers: dict):
        """Listing BOMs should return 200."""
        response = client.get("/api/v1/bom", headers=auth_headers)
        assert response.status_code == 200

    def test_list_boms_returns_paginated(self, client: TestClient, auth_headers: dict):
        """List should return paginated response."""
        response = client.get("/api/v1/bom", headers=auth_headers)
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "offset" in data
        assert "limit" in data


class TestGetBOM:
    """Tests for GET /api/v1/bom/{id}."""

    def test_get_bom_returns_200(self, client: TestClient, auth_headers: dict):
        """Getting a BOM should return 200."""
        ing_id = create_ingredient(client, auth_headers)
        recipe_id = create_recipe(
            client, auth_headers, "Get Test", "4",
            [{"ingredient_id": ing_id, "quantity": "2", "unit": "cup"}]
        )
        
        create_response = client.post(
            "/api/v1/bom/generate",
            json={
                "name": "Get Test BOM",
                "date": "2026-01-29",
                "recipes": [{"recipe_id": recipe_id, "portions": "4"}],
            },
            headers=auth_headers,
        )
        bom_id = create_response.json()["id"]
        
        response = client.get(f"/api/v1/bom/{bom_id}", headers=auth_headers)
        assert response.status_code == 200

    def test_get_bom_not_found_returns_404(self, client: TestClient, auth_headers: dict):
        """Non-existent BOM should return 404."""
        response = client.get("/api/v1/bom/99999", headers=auth_headers)
        assert response.status_code == 404


class TestDeleteBOM:
    """Tests for DELETE /api/v1/bom/{id}."""

    def test_delete_bom_returns_204(self, client: TestClient, auth_headers: dict):
        """Deleting a BOM should return 204."""
        ing_id = create_ingredient(client, auth_headers)
        recipe_id = create_recipe(
            client, auth_headers, "Delete Test", "4",
            [{"ingredient_id": ing_id, "quantity": "2", "unit": "cup"}]
        )
        
        create_response = client.post(
            "/api/v1/bom/generate",
            json={
                "name": "Delete Test BOM",
                "date": "2026-01-29",
                "recipes": [{"recipe_id": recipe_id, "portions": "4"}],
            },
            headers=auth_headers,
        )
        bom_id = create_response.json()["id"]
        
        response = client.delete(f"/api/v1/bom/{bom_id}", headers=auth_headers)
        assert response.status_code == 204

    def test_deleted_bom_not_found(self, client: TestClient, auth_headers: dict):
        """Deleted BOM should return 404 on get."""
        ing_id = create_ingredient(client, auth_headers)
        recipe_id = create_recipe(
            client, auth_headers, "Delete Test 2", "4",
            [{"ingredient_id": ing_id, "quantity": "2", "unit": "cup"}]
        )
        
        create_response = client.post(
            "/api/v1/bom/generate",
            json={
                "name": "Delete Verify BOM",
                "date": "2026-01-29",
                "recipes": [{"recipe_id": recipe_id, "portions": "4"}],
            },
            headers=auth_headers,
        )
        bom_id = create_response.json()["id"]
        
        client.delete(f"/api/v1/bom/{bom_id}", headers=auth_headers)
        
        response = client.get(f"/api/v1/bom/{bom_id}", headers=auth_headers)
        assert response.status_code == 404
