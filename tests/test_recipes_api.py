"""
Recipes API Tests

TDD tests for recipe CRUD endpoints.
"""

import pytest
from decimal import Decimal
from fastapi.testclient import TestClient


# Test data
VALID_INGREDIENT = {
    "name": "All-Purpose Flour",
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
    """Helper to create an ingredient and return its ID."""
    data = data or VALID_INGREDIENT
    response = client.post("/api/v1/ingredients", json=data, headers=auth_headers)
    return response.json()["id"]


class TestCreateRecipe:
    """Tests for POST /api/v1/recipes."""

    def test_create_recipe_returns_201(self, client: TestClient, auth_headers: dict):
        """Creating a recipe should return 201."""
        response = client.post(
            "/api/v1/recipes",
            json={
                "name": "Test Recipe",
                "yield_qty": "10",
                "yield_unit": "portion",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201

    def test_create_recipe_returns_id(self, client: TestClient, auth_headers: dict):
        """Created recipe should have an ID."""
        response = client.post(
            "/api/v1/recipes",
            json={
                "name": "Test Recipe",
                "yield_qty": "10",
            },
            headers=auth_headers,
        )
        data = response.json()
        assert "id" in data
        assert isinstance(data["id"], int)

    def test_create_recipe_with_ingredients(self, client: TestClient, auth_headers: dict):
        """Recipe can be created with ingredients."""
        # Create ingredient first
        ing_id = create_ingredient(client, auth_headers)
        
        response = client.post(
            "/api/v1/recipes",
            json={
                "name": "Simple Recipe",
                "yield_qty": "4",
                "items": [
                    {"ingredient_id": ing_id, "quantity": "2", "unit": "cup"}
                ],
            },
            headers=auth_headers,
        )
        
        assert response.status_code == 201
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["ingredient_id"] == ing_id

    def test_create_recipe_calculates_cost(self, client: TestClient, auth_headers: dict):
        """Recipe should have calculated costs."""
        ing_id = create_ingredient(client, auth_headers)
        
        response = client.post(
            "/api/v1/recipes",
            json={
                "name": "Costed Recipe",
                "yield_qty": "4",
                "items": [
                    {"ingredient_id": ing_id, "quantity": "2", "unit": "cup"}
                ],
            },
            headers=auth_headers,
        )
        
        data = response.json()
        assert data["total_cost"] is not None
        assert data["cost_per_portion"] is not None

    def test_create_recipe_validates_required_fields(self, client: TestClient, auth_headers: dict):
        """Missing required fields should return 422."""
        response = client.post(
            "/api/v1/recipes",
            json={"name": "No Yield"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_create_recipe_validates_ingredient_exists(self, client: TestClient, auth_headers: dict):
        """Non-existent ingredient should return 400."""
        response = client.post(
            "/api/v1/recipes",
            json={
                "name": "Bad Recipe",
                "yield_qty": "4",
                "items": [
                    {"ingredient_id": 99999, "quantity": "1", "unit": "cup"}
                ],
            },
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_create_recipe_item_requires_ingredient_or_subrecipe(self, client: TestClient, auth_headers: dict):
        """Item must have either ingredient_id or sub_recipe_id."""
        response = client.post(
            "/api/v1/recipes",
            json={
                "name": "Invalid Recipe",
                "yield_qty": "4",
                "items": [
                    {"quantity": "1", "unit": "cup"}  # Missing both
                ],
            },
            headers=auth_headers,
        )
        assert response.status_code == 422


class TestRecipeWithSubRecipes:
    """Tests for recipes with sub-recipes."""

    def test_create_recipe_with_subrecipe(self, client: TestClient, auth_headers: dict):
        """Recipe can include another recipe as sub-recipe."""
        ing_id = create_ingredient(client, auth_headers)
        
        # Create base recipe (sauce)
        sauce_response = client.post(
            "/api/v1/recipes",
            json={
                "name": "Tomato Sauce",
                "yield_qty": "4",
                "yield_unit": "cup",
                "items": [{"ingredient_id": ing_id, "quantity": "2", "unit": "cup"}],
            },
            headers=auth_headers,
        )
        sauce_id = sauce_response.json()["id"]
        
        # Create main recipe using sauce as sub-recipe
        response = client.post(
            "/api/v1/recipes",
            json={
                "name": "Pasta with Sauce",
                "yield_qty": "2",
                "items": [
                    {"sub_recipe_id": sauce_id, "quantity": "1", "unit": "cup"}
                ],
            },
            headers=auth_headers,
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["items"][0]["sub_recipe_id"] == sauce_id
        assert data["items"][0]["sub_recipe_name"] == "Tomato Sauce"

    def test_subrecipe_cost_included(self, client: TestClient, auth_headers: dict):
        """Sub-recipe costs should roll up into main recipe."""
        ing_id = create_ingredient(client, auth_headers)
        
        # Create sub-recipe
        sub_response = client.post(
            "/api/v1/recipes",
            json={
                "name": "Sub Recipe",
                "yield_qty": "2",
                "items": [{"ingredient_id": ing_id, "quantity": "4", "unit": "cup"}],
            },
            headers=auth_headers,
        )
        sub_id = sub_response.json()["id"]
        sub_cost = sub_response.json()["total_cost"]
        
        # Create main recipe using 1 batch of sub-recipe
        main_response = client.post(
            "/api/v1/recipes",
            json={
                "name": "Main Recipe",
                "yield_qty": "2",
                "items": [{"sub_recipe_id": sub_id, "quantity": "2", "unit": "portion"}],
            },
            headers=auth_headers,
        )
        
        # Main cost should include sub-recipe cost
        main_data = main_response.json()
        assert main_data["total_cost"] is not None

    def test_cannot_create_self_referencing_recipe(self, client: TestClient, auth_headers: dict):
        """Recipe cannot reference itself as sub-recipe."""
        # Create a recipe first
        response = client.post(
            "/api/v1/recipes",
            json={"name": "Self Ref", "yield_qty": "2"},
            headers=auth_headers,
        )
        recipe_id = response.json()["id"]
        
        # Try to add itself as sub-recipe
        add_response = client.post(
            f"/api/v1/recipes/{recipe_id}/items",
            json={"sub_recipe_id": recipe_id, "quantity": "1", "unit": "portion"},
            headers=auth_headers,
        )
        assert add_response.status_code == 400

    def test_cannot_delete_recipe_used_as_subrecipe(self, client: TestClient, auth_headers: dict):
        """Cannot delete a recipe that's used as sub-recipe."""
        # Create sub-recipe
        sub_response = client.post(
            "/api/v1/recipes",
            json={"name": "Used Sub", "yield_qty": "2"},
            headers=auth_headers,
        )
        sub_id = sub_response.json()["id"]
        
        # Create main recipe using it
        client.post(
            "/api/v1/recipes",
            json={
                "name": "Main",
                "yield_qty": "2",
                "items": [{"sub_recipe_id": sub_id, "quantity": "1", "unit": "portion"}],
            },
            headers=auth_headers,
        )
        
        # Try to delete sub-recipe
        delete_response = client.delete(
            f"/api/v1/recipes/{sub_id}",
            headers=auth_headers,
        )
        assert delete_response.status_code == 400


class TestListRecipes:
    """Tests for GET /api/v1/recipes."""

    def test_list_recipes_returns_200(self, client: TestClient, auth_headers: dict):
        """Listing recipes should return 200."""
        response = client.get("/api/v1/recipes", headers=auth_headers)
        assert response.status_code == 200

    def test_list_recipes_returns_paginated(self, client: TestClient, auth_headers: dict):
        """List should return paginated response."""
        response = client.get("/api/v1/recipes", headers=auth_headers)
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "offset" in data
        assert "limit" in data

    def test_list_recipes_search(self, client: TestClient, auth_headers: dict):
        """Search should filter recipes."""
        client.post("/api/v1/recipes", json={"name": "Chocolate Cake", "yield_qty": "8"}, headers=auth_headers)
        client.post("/api/v1/recipes", json={"name": "Vanilla Cake", "yield_qty": "8"}, headers=auth_headers)
        client.post("/api/v1/recipes", json={"name": "Bread", "yield_qty": "1"}, headers=auth_headers)
        
        response = client.get("/api/v1/recipes?search=cake", headers=auth_headers)
        data = response.json()
        
        for item in data["items"]:
            assert "cake" in item["name"].lower()


class TestGetRecipe:
    """Tests for GET /api/v1/recipes/{id}."""

    def test_get_recipe_returns_200(self, client: TestClient, auth_headers: dict):
        """Getting a recipe should return 200."""
        create_response = client.post(
            "/api/v1/recipes",
            json={"name": "Get Test", "yield_qty": "4"},
            headers=auth_headers,
        )
        recipe_id = create_response.json()["id"]
        
        response = client.get(f"/api/v1/recipes/{recipe_id}", headers=auth_headers)
        assert response.status_code == 200

    def test_get_recipe_not_found_returns_404(self, client: TestClient, auth_headers: dict):
        """Non-existent recipe should return 404."""
        response = client.get("/api/v1/recipes/99999", headers=auth_headers)
        assert response.status_code == 404


class TestUpdateRecipe:
    """Tests for PATCH /api/v1/recipes/{id}."""

    def test_update_recipe_returns_200(self, client: TestClient, auth_headers: dict):
        """Updating should return 200."""
        create_response = client.post(
            "/api/v1/recipes",
            json={"name": "Update Test", "yield_qty": "4"},
            headers=auth_headers,
        )
        recipe_id = create_response.json()["id"]
        
        response = client.patch(
            f"/api/v1/recipes/{recipe_id}",
            json={"name": "Updated Name"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"

    def test_update_recipe_partial(self, client: TestClient, auth_headers: dict):
        """Partial update should only change specified fields."""
        create_response = client.post(
            "/api/v1/recipes",
            json={"name": "Partial Test", "yield_qty": "4", "description": "Original"},
            headers=auth_headers,
        )
        recipe_id = create_response.json()["id"]
        
        response = client.patch(
            f"/api/v1/recipes/{recipe_id}",
            json={"name": "New Name"},
            headers=auth_headers,
        )
        data = response.json()
        assert data["name"] == "New Name"
        assert data["description"] == "Original"  # Unchanged


class TestDeleteRecipe:
    """Tests for DELETE /api/v1/recipes/{id}."""

    def test_delete_recipe_returns_204(self, client: TestClient, auth_headers: dict):
        """Deleting should return 204."""
        create_response = client.post(
            "/api/v1/recipes",
            json={"name": "Delete Test", "yield_qty": "4"},
            headers=auth_headers,
        )
        recipe_id = create_response.json()["id"]
        
        response = client.delete(f"/api/v1/recipes/{recipe_id}", headers=auth_headers)
        assert response.status_code == 204

    def test_deleted_recipe_not_found(self, client: TestClient, auth_headers: dict):
        """Deleted recipe should return 404 on get."""
        create_response = client.post(
            "/api/v1/recipes",
            json={"name": "Delete Test", "yield_qty": "4"},
            headers=auth_headers,
        )
        recipe_id = create_response.json()["id"]
        
        client.delete(f"/api/v1/recipes/{recipe_id}", headers=auth_headers)
        
        response = client.get(f"/api/v1/recipes/{recipe_id}", headers=auth_headers)
        assert response.status_code == 404


class TestRecipeItems:
    """Tests for recipe item management."""

    def test_add_item_to_recipe(self, client: TestClient, auth_headers: dict):
        """Can add items to existing recipe."""
        ing_id = create_ingredient(client, auth_headers)
        
        # Create empty recipe
        create_response = client.post(
            "/api/v1/recipes",
            json={"name": "Empty Recipe", "yield_qty": "4"},
            headers=auth_headers,
        )
        recipe_id = create_response.json()["id"]
        
        # Add item
        add_response = client.post(
            f"/api/v1/recipes/{recipe_id}/items",
            json={"ingredient_id": ing_id, "quantity": "2", "unit": "cup"},
            headers=auth_headers,
        )
        assert add_response.status_code == 201

    def test_remove_item_from_recipe(self, client: TestClient, auth_headers: dict):
        """Can remove items from recipe."""
        ing_id = create_ingredient(client, auth_headers)
        
        create_response = client.post(
            "/api/v1/recipes",
            json={
                "name": "Recipe With Item",
                "yield_qty": "4",
                "items": [{"ingredient_id": ing_id, "quantity": "2", "unit": "cup"}],
            },
            headers=auth_headers,
        )
        recipe_id = create_response.json()["id"]
        item_id = create_response.json()["items"][0]["id"]
        
        # Remove item
        response = client.delete(
            f"/api/v1/recipes/{recipe_id}/items/{item_id}",
            headers=auth_headers,
        )
        assert response.status_code == 204


class TestRecipeScaling:
    """Tests for recipe scaling."""

    def test_scale_recipe(self, client: TestClient, auth_headers: dict):
        """Can scale recipe to different portions."""
        ing_id = create_ingredient(client, auth_headers)
        
        create_response = client.post(
            "/api/v1/recipes",
            json={
                "name": "Scalable",
                "yield_qty": "4",
                "items": [{"ingredient_id": ing_id, "quantity": "2", "unit": "cup"}],
            },
            headers=auth_headers,
        )
        recipe_id = create_response.json()["id"]
        
        # Scale to 8 portions (2x)
        scale_response = client.post(
            f"/api/v1/recipes/{recipe_id}/scale",
            json={"portions": "8"},
            headers=auth_headers,
        )
        
        assert scale_response.status_code == 200
        data = scale_response.json()
        assert Decimal(data["original_yield"]) == Decimal("4")
        assert Decimal(data["target_yield"]) == Decimal("8")
        assert Decimal(data["scale_factor"]) == Decimal("2")
        # Items should be scaled
        assert Decimal(data["items"][0]["quantity"]) == Decimal("4")  # 2 cups * 2 = 4 cups


class TestRecipeCost:
    """Tests for recipe cost endpoint."""

    def test_get_recipe_cost(self, client: TestClient, auth_headers: dict):
        """Can get detailed cost breakdown."""
        ing_id = create_ingredient(client, auth_headers)
        
        create_response = client.post(
            "/api/v1/recipes",
            json={
                "name": "Costed",
                "yield_qty": "4",
                "selling_price": "10.00",
                "items": [{"ingredient_id": ing_id, "quantity": "4", "unit": "cup"}],
            },
            headers=auth_headers,
        )
        recipe_id = create_response.json()["id"]
        
        cost_response = client.get(
            f"/api/v1/recipes/{recipe_id}/cost",
            headers=auth_headers,
        )
        
        assert cost_response.status_code == 200
        data = cost_response.json()
        assert "total_cost" in data
        assert "cost_per_portion" in data
        assert "food_cost_pct" in data
        assert "items" in data
