"""
Cost Calculator Service

Handles ingredient and recipe cost calculations.
"""

from decimal import Decimal
from typing import Optional, Set

from database.models import Ingredient, Recipe, RecipeItem
from .unit_converter import convert, UnitConversionError


class CostCalculationError(Exception):
    """Raised when cost calculation fails."""
    pass


class RecipeCycleError(CostCalculationError):
    """Raised when a cycle is detected in recipe references."""
    pass


def get_ingredient_unit_cost(
    ingredient: Ingredient,
    target_unit: Optional[str] = None,
) -> Decimal:
    """
    Calculate the cost per unit of an ingredient.
    
    Formula:
        base_cost = purchase_price / purchase_qty
        with_yield = base_cost / (yield_percent / 100)
        converted = with_yield * conversion_factor (if needed)
    
    Args:
        ingredient: The ingredient
        target_unit: Unit to calculate cost for (defaults to recipe_unit)
    
    Returns:
        Cost per target_unit
    """
    if target_unit is None:
        target_unit = ingredient.recipe_unit
    
    # Base cost per purchase unit quantity
    # e.g., $10 for 5 lb bag = $2/lb
    purchase_price = Decimal(str(ingredient.purchase_price))
    purchase_qty = Decimal(str(ingredient.purchase_qty))
    
    if purchase_qty == 0:
        raise CostCalculationError(f"Ingredient {ingredient.name} has zero purchase quantity")
    
    base_cost_per_purchase_unit = purchase_price / purchase_qty
    
    # Convert to cost per recipe unit using conversion factor
    # conversion_factor = recipe_units per purchase_unit
    # e.g., 1 lb = 16 oz, so conversion_factor = 16
    conversion_factor = Decimal(str(ingredient.conversion_factor))
    
    if conversion_factor == 0:
        raise CostCalculationError(f"Ingredient {ingredient.name} has zero conversion factor")
    
    cost_per_recipe_unit = base_cost_per_purchase_unit / conversion_factor
    
    # Apply yield percentage
    # e.g., 80% yield means we lose 20%, so effective cost is higher
    yield_percent = Decimal(str(ingredient.yield_percent))
    
    if yield_percent == 0:
        raise CostCalculationError(f"Ingredient {ingredient.name} has zero yield percent")
    
    cost_with_yield = cost_per_recipe_unit / (yield_percent / Decimal("100"))
    
    # Convert to target unit if different from recipe_unit
    recipe_unit = ingredient.recipe_unit.lower().strip()
    target_unit = target_unit.lower().strip()
    
    if recipe_unit == target_unit:
        return cost_with_yield
    
    # Convert 1 target_unit to recipe_units, multiply by cost
    try:
        recipe_units_per_target = convert(1, target_unit, recipe_unit)
        return cost_with_yield * recipe_units_per_target
    except UnitConversionError as e:
        raise CostCalculationError(
            f"Cannot convert {target_unit} to {recipe_unit} for {ingredient.name}: {e}"
        )


def calculate_recipe_item_cost(
    item: RecipeItem,
    scale: Decimal = Decimal("1"),
    visited: Optional[Set[int]] = None,
) -> Decimal:
    """
    Calculate the cost of a single recipe item.
    
    Args:
        item: The recipe item
        scale: Scaling factor
        visited: Set of visited recipe IDs (for cycle detection)
    
    Returns:
        Total cost for this item at the given scale
    """
    if visited is None:
        visited = set()
    
    quantity = Decimal(str(item.quantity)) * scale
    
    if item.ingredient_id is not None and item.ingredient is not None:
        # Direct ingredient
        unit_cost = get_ingredient_unit_cost(item.ingredient, item.unit)
        return quantity * unit_cost
    
    elif item.sub_recipe_id is not None and item.sub_recipe is not None:
        # Sub-recipe
        if item.sub_recipe_id in visited:
            raise RecipeCycleError(
                f"Cycle detected: recipe {item.sub_recipe_id} is referenced recursively"
            )
        
        # The quantity is in terms of the sub-recipe's yield
        # e.g., 2 cups of sauce, where sauce yields 4 cups
        # We need (2/4) = 0.5 batches of the sauce
        sub_recipe = item.sub_recipe
        sub_yield = Decimal(str(sub_recipe.yield_qty))
        
        if sub_yield == 0:
            raise CostCalculationError(f"Sub-recipe {sub_recipe.name} has zero yield")
        
        # Calculate full batch cost of sub-recipe
        batch_cost = calculate_recipe_cost(
            sub_recipe,
            scale=Decimal("1"),
            visited=visited | {item.recipe_id},
        )
        
        # Cost for the quantity we need
        batches_needed = quantity / sub_yield
        return batch_cost * batches_needed
    
    else:
        raise CostCalculationError(f"Recipe item has no ingredient or sub-recipe")


def calculate_recipe_cost(
    recipe: Recipe,
    scale: Decimal = Decimal("1"),
    visited: Optional[Set[int]] = None,
) -> Decimal:
    """
    Calculate the total cost of a recipe.
    
    Args:
        recipe: The recipe
        scale: Scaling factor (1.0 = one batch)
        visited: Set of visited recipe IDs (for cycle detection)
    
    Returns:
        Total recipe cost at the given scale
    """
    if visited is None:
        visited = set()
    
    if recipe.id in visited:
        raise RecipeCycleError(
            f"Cycle detected: recipe {recipe.id} ({recipe.name}) is referenced recursively"
        )
    
    visited = visited | {recipe.id}
    total_cost = Decimal("0")
    
    for item in recipe.items:
        item_cost = calculate_recipe_item_cost(item, scale, visited)
        total_cost += item_cost
    
    return total_cost


def calculate_cost_per_portion(
    recipe: Recipe,
    scale: Decimal = Decimal("1"),
) -> Decimal:
    """
    Calculate the cost per portion/serving.
    
    Args:
        recipe: The recipe
        scale: Scaling factor
    
    Returns:
        Cost per yield_unit
    """
    total_cost = calculate_recipe_cost(recipe, scale)
    yield_qty = Decimal(str(recipe.yield_qty)) * scale
    
    if yield_qty == 0:
        raise CostCalculationError(f"Recipe {recipe.name} has zero yield")
    
    return total_cost / yield_qty


def calculate_food_cost_percentage(
    recipe: Recipe,
    selling_price: Optional[Decimal] = None,
) -> Optional[Decimal]:
    """
    Calculate the food cost percentage.
    
    Formula: (cost per portion / selling price) * 100
    
    Args:
        recipe: The recipe
        selling_price: Override selling price (uses recipe.selling_price if None)
    
    Returns:
        Food cost percentage, or None if no selling price
    """
    price = selling_price or (
        Decimal(str(recipe.selling_price)) if recipe.selling_price else None
    )
    
    if price is None or price == 0:
        return None
    
    cost_per_portion = calculate_cost_per_portion(recipe)
    return (cost_per_portion / price) * Decimal("100")
