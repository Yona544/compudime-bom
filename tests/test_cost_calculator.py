"""
Cost Calculator Tests

TDD tests for cost calculation service.
"""

import pytest
from decimal import Decimal
from unittest.mock import MagicMock

from api.services.cost_calculator import (
    get_ingredient_unit_cost,
    calculate_recipe_cost,
    calculate_cost_per_portion,
    calculate_food_cost_percentage,
    CostCalculationError,
    RecipeCycleError,
)


def make_ingredient(
    name: str = "Test Ingredient",
    purchase_price: Decimal = Decimal("10.00"),
    purchase_qty: Decimal = Decimal("5"),
    purchase_unit: str = "lb",
    recipe_unit: str = "oz",
    conversion_factor: Decimal = Decimal("16"),  # 16 oz per lb
    yield_percent: Decimal = Decimal("100"),
) -> MagicMock:
    """Create a mock ingredient for testing."""
    ingredient = MagicMock()
    ingredient.name = name
    ingredient.purchase_price = purchase_price
    ingredient.purchase_qty = purchase_qty
    ingredient.purchase_unit = purchase_unit
    ingredient.recipe_unit = recipe_unit
    ingredient.conversion_factor = conversion_factor
    ingredient.yield_percent = yield_percent
    return ingredient


def make_recipe_item(
    ingredient=None,
    sub_recipe=None,
    quantity: Decimal = Decimal("1"),
    unit: str = "oz",
    recipe_id: int = 1,
) -> MagicMock:
    """Create a mock recipe item for testing."""
    item = MagicMock()
    item.quantity = quantity
    item.unit = unit
    item.recipe_id = recipe_id
    
    if ingredient:
        item.ingredient_id = 1
        item.ingredient = ingredient
        item.sub_recipe_id = None
        item.sub_recipe = None
    elif sub_recipe:
        item.ingredient_id = None
        item.ingredient = None
        item.sub_recipe_id = sub_recipe.id
        item.sub_recipe = sub_recipe
    else:
        item.ingredient_id = None
        item.ingredient = None
        item.sub_recipe_id = None
        item.sub_recipe = None
    
    return item


def make_recipe(
    id: int = 1,
    name: str = "Test Recipe",
    yield_qty: Decimal = Decimal("10"),
    yield_unit: str = "portion",
    items: list = None,
    selling_price: Decimal = None,
) -> MagicMock:
    """Create a mock recipe for testing."""
    recipe = MagicMock()
    recipe.id = id
    recipe.name = name
    recipe.yield_qty = yield_qty
    recipe.yield_unit = yield_unit
    recipe.items = items or []
    recipe.selling_price = selling_price
    return recipe


class TestGetIngredientUnitCost:
    """Tests for get_ingredient_unit_cost."""

    def test_simple_cost(self):
        """Basic cost calculation without yield adjustment."""
        # $10 for 5 lb, 16 oz/lb = $10 / (5 * 16) = $0.125/oz
        ingredient = make_ingredient(
            purchase_price=Decimal("10.00"),
            purchase_qty=Decimal("5"),
            conversion_factor=Decimal("16"),
            yield_percent=Decimal("100"),
        )
        
        cost = get_ingredient_unit_cost(ingredient)
        assert cost == Decimal("0.125")

    def test_cost_with_yield(self):
        """Cost calculation with yield percentage."""
        # $10 for 5 lb at 80% yield
        # Base: $0.125/oz, with yield: $0.125 / 0.80 = $0.15625/oz
        ingredient = make_ingredient(
            purchase_price=Decimal("10.00"),
            purchase_qty=Decimal("5"),
            conversion_factor=Decimal("16"),
            yield_percent=Decimal("80"),
        )
        
        cost = get_ingredient_unit_cost(ingredient)
        assert cost == Decimal("0.15625")

    def test_cost_in_different_unit(self):
        """Cost calculation in a different target unit."""
        # $10 for 5 lb, want cost per lb (not oz)
        # $10 / 5 = $2/lb
        ingredient = make_ingredient(
            purchase_price=Decimal("10.00"),
            purchase_qty=Decimal("5"),
            purchase_unit="lb",
            recipe_unit="oz",
            conversion_factor=Decimal("16"),
            yield_percent=Decimal("100"),
        )
        
        # Cost per oz is $0.125, cost per lb = $0.125 * 16 = $2
        cost = get_ingredient_unit_cost(ingredient, target_unit="lb")
        assert cost == Decimal("2")

    def test_zero_purchase_qty_raises(self):
        """Zero purchase quantity should raise error."""
        ingredient = make_ingredient(purchase_qty=Decimal("0"))
        
        with pytest.raises(CostCalculationError) as exc_info:
            get_ingredient_unit_cost(ingredient)
        assert "zero purchase quantity" in str(exc_info.value)

    def test_zero_conversion_factor_raises(self):
        """Zero conversion factor should raise error."""
        ingredient = make_ingredient(conversion_factor=Decimal("0"))
        
        with pytest.raises(CostCalculationError) as exc_info:
            get_ingredient_unit_cost(ingredient)
        assert "zero conversion factor" in str(exc_info.value)

    def test_zero_yield_raises(self):
        """Zero yield should raise error."""
        ingredient = make_ingredient(yield_percent=Decimal("0"))
        
        with pytest.raises(CostCalculationError) as exc_info:
            get_ingredient_unit_cost(ingredient)
        assert "zero yield percent" in str(exc_info.value)


class TestCalculateRecipeCost:
    """Tests for calculate_recipe_cost."""

    def test_recipe_with_one_ingredient(self):
        """Recipe with single ingredient."""
        ingredient = make_ingredient(
            purchase_price=Decimal("10.00"),
            purchase_qty=Decimal("5"),
            conversion_factor=Decimal("16"),
            yield_percent=Decimal("100"),
        )
        
        item = make_recipe_item(ingredient=ingredient, quantity=Decimal("8"), unit="oz")
        recipe = make_recipe(items=[item])
        
        # 8 oz at $0.125/oz = $1.00
        cost = calculate_recipe_cost(recipe)
        assert cost == Decimal("1.00")

    def test_recipe_with_multiple_ingredients(self):
        """Recipe with multiple ingredients."""
        ingredient1 = make_ingredient(
            name="Flour",
            purchase_price=Decimal("5.00"),
            purchase_qty=Decimal("5"),
            conversion_factor=Decimal("16"),
        )
        ingredient2 = make_ingredient(
            name="Sugar",
            purchase_price=Decimal("10.00"),
            purchase_qty=Decimal("10"),
            conversion_factor=Decimal("16"),
        )
        
        item1 = make_recipe_item(ingredient=ingredient1, quantity=Decimal("16"), unit="oz")  # $1.00
        item2 = make_recipe_item(ingredient=ingredient2, quantity=Decimal("8"), unit="oz")   # $0.50
        recipe = make_recipe(items=[item1, item2])
        
        cost = calculate_recipe_cost(recipe)
        assert cost == Decimal("1.50")

    def test_recipe_with_scale(self):
        """Recipe cost scales correctly."""
        ingredient = make_ingredient(
            purchase_price=Decimal("10.00"),
            purchase_qty=Decimal("5"),
            conversion_factor=Decimal("16"),
        )
        
        item = make_recipe_item(ingredient=ingredient, quantity=Decimal("8"), unit="oz")
        recipe = make_recipe(items=[item])
        
        # Base: $1.00, scaled 2x = $2.00
        cost = calculate_recipe_cost(recipe, scale=Decimal("2"))
        assert cost == Decimal("2.00")

    def test_empty_recipe(self):
        """Empty recipe has zero cost."""
        recipe = make_recipe(items=[])
        cost = calculate_recipe_cost(recipe)
        assert cost == Decimal("0")


class TestCalculateCostPerPortion:
    """Tests for calculate_cost_per_portion."""

    def test_cost_per_portion(self):
        """Cost per portion is total / yield."""
        ingredient = make_ingredient(
            purchase_price=Decimal("10.00"),
            purchase_qty=Decimal("5"),
            conversion_factor=Decimal("16"),
        )
        
        item = make_recipe_item(ingredient=ingredient, quantity=Decimal("80"), unit="oz")
        recipe = make_recipe(yield_qty=Decimal("10"), items=[item])
        
        # Total: $10.00, yield: 10 = $1.00/portion
        cost = calculate_cost_per_portion(recipe)
        assert cost == Decimal("1.00")

    def test_zero_yield_raises(self):
        """Zero yield should raise error."""
        recipe = make_recipe(yield_qty=Decimal("0"), items=[])
        
        with pytest.raises(CostCalculationError) as exc_info:
            calculate_cost_per_portion(recipe)
        assert "zero yield" in str(exc_info.value)


class TestCalculateFoodCostPercentage:
    """Tests for calculate_food_cost_percentage."""

    def test_food_cost_percentage(self):
        """Food cost percentage calculation."""
        ingredient = make_ingredient(
            purchase_price=Decimal("10.00"),
            purchase_qty=Decimal("5"),
            conversion_factor=Decimal("16"),
        )
        
        item = make_recipe_item(ingredient=ingredient, quantity=Decimal("80"), unit="oz")
        recipe = make_recipe(
            yield_qty=Decimal("10"),
            items=[item],
            selling_price=Decimal("4.00"),
        )
        
        # Cost: $1.00/portion, selling: $4.00 = 25%
        pct = calculate_food_cost_percentage(recipe)
        assert pct == Decimal("25")

    def test_no_selling_price_returns_none(self):
        """No selling price returns None."""
        recipe = make_recipe(yield_qty=Decimal("10"), items=[], selling_price=None)
        
        pct = calculate_food_cost_percentage(recipe)
        assert pct is None

    def test_override_selling_price(self):
        """Can override selling price."""
        ingredient = make_ingredient(
            purchase_price=Decimal("10.00"),
            purchase_qty=Decimal("5"),
            conversion_factor=Decimal("16"),
        )
        
        item = make_recipe_item(ingredient=ingredient, quantity=Decimal("80"), unit="oz")
        recipe = make_recipe(
            yield_qty=Decimal("10"),
            items=[item],
            selling_price=Decimal("4.00"),
        )
        
        # Cost: $1.00, override price: $5.00 = 20%
        pct = calculate_food_cost_percentage(recipe, selling_price=Decimal("5.00"))
        assert pct == Decimal("20")


class TestRecipeCycleDetection:
    """Tests for cycle detection in recipes."""

    def test_self_referencing_recipe_raises(self):
        """Recipe that references itself should raise error."""
        recipe = make_recipe(id=1, name="Self-ref")
        
        # Item references the same recipe as sub-recipe
        item = MagicMock()
        item.quantity = Decimal("1")
        item.unit = "portion"
        item.recipe_id = 1
        item.ingredient_id = None
        item.ingredient = None
        item.sub_recipe_id = 1
        item.sub_recipe = recipe
        
        recipe.items = [item]
        
        with pytest.raises(RecipeCycleError):
            calculate_recipe_cost(recipe)
