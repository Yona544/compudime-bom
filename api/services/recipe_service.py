"""
Recipe Service

Business logic for recipe operations.
"""

from decimal import Decimal
from typing import Optional, List, Tuple, Set

from sqlalchemy.orm import Session, joinedload

from database.models import Recipe, RecipeItem, Ingredient
from api.schemas.recipe import RecipeCreate, RecipeUpdate, RecipeItemCreate
from .cost_calculator import (
    calculate_recipe_cost,
    calculate_cost_per_portion,
    calculate_food_cost_percentage,
    calculate_recipe_item_cost,
    CostCalculationError,
    RecipeCycleError,
)


class RecipeService:
    """Service for recipe CRUD operations."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create(self, user_id: int, data: RecipeCreate) -> Recipe:
        """Create a new recipe with items."""
        # Validate sub-recipe references
        for item in data.items:
            if item.sub_recipe_id:
                sub_recipe = self.get(user_id, item.sub_recipe_id)
                if sub_recipe is None:
                    raise ValueError(f"Sub-recipe with id {item.sub_recipe_id} not found")
            if item.ingredient_id:
                ingredient = self.db.query(Ingredient).filter(
                    Ingredient.id == item.ingredient_id,
                    Ingredient.user_id == user_id,
                ).first()
                if ingredient is None:
                    raise ValueError(f"Ingredient with id {item.ingredient_id} not found")
        
        recipe = Recipe(
            user_id=user_id,
            name=data.name,
            description=data.description,
            yield_qty=data.yield_qty,
            yield_unit=data.yield_unit,
            prep_time_min=data.prep_time_min,
            cook_time_min=data.cook_time_min,
            selling_price=data.selling_price,
            target_cost_pct=data.target_cost_pct,
            category_id=data.category_id,
            instructions=data.instructions,
        )
        
        self.db.add(recipe)
        self.db.flush()  # Get recipe.id
        
        # Create items
        for idx, item_data in enumerate(data.items):
            item = RecipeItem(
                recipe_id=recipe.id,
                ingredient_id=item_data.ingredient_id,
                sub_recipe_id=item_data.sub_recipe_id,
                quantity=item_data.quantity,
                unit=item_data.unit,
                sort_order=item_data.sort_order or idx,
                notes=item_data.notes,
            )
            self.db.add(item)
        
        self.db.commit()
        self.db.refresh(recipe)
        
        return self._load_recipe_with_relations(recipe.id)
    
    def get(self, user_id: int, recipe_id: int) -> Optional[Recipe]:
        """Get a recipe by ID (scoped to user) with all relations loaded."""
        recipe = self.db.query(Recipe).filter(
            Recipe.id == recipe_id,
            Recipe.user_id == user_id,
        ).first()
        
        if recipe:
            return self._load_recipe_with_relations(recipe.id)
        return None
    
    def _load_recipe_with_relations(self, recipe_id: int) -> Recipe:
        """Load a recipe with all relations eagerly loaded."""
        return self.db.query(Recipe).options(
            joinedload(Recipe.items).joinedload(RecipeItem.ingredient),
            joinedload(Recipe.items).joinedload(RecipeItem.sub_recipe),
        ).filter(Recipe.id == recipe_id).first()
    
    def list(
        self,
        user_id: int,
        offset: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        category_id: Optional[int] = None,
    ) -> Tuple[List[Recipe], int]:
        """List recipes with pagination and filtering."""
        query = self.db.query(Recipe).filter(Recipe.user_id == user_id)
        
        if search:
            query = query.filter(Recipe.name.ilike(f"%{search}%"))
        
        if category_id is not None:
            query = query.filter(Recipe.category_id == category_id)
        
        total = query.count()
        
        recipe_ids = [r.id for r in query.order_by(Recipe.name).offset(offset).limit(limit).all()]
        
        # Load with relations
        if recipe_ids:
            items = self.db.query(Recipe).options(
                joinedload(Recipe.items).joinedload(RecipeItem.ingredient),
                joinedload(Recipe.items).joinedload(RecipeItem.sub_recipe),
            ).filter(Recipe.id.in_(recipe_ids)).all()
            
            # Sort to match original order
            items_dict = {r.id: r for r in items}
            items = [items_dict[rid] for rid in recipe_ids]
        else:
            items = []
        
        return items, total
    
    def update(
        self,
        user_id: int,
        recipe_id: int,
        data: RecipeUpdate,
    ) -> Optional[Recipe]:
        """Update a recipe (partial update)."""
        recipe = self.db.query(Recipe).filter(
            Recipe.id == recipe_id,
            Recipe.user_id == user_id,
        ).first()
        
        if recipe is None:
            return None
        
        update_data = data.model_dump(exclude_unset=True)
        
        for field, value in update_data.items():
            setattr(recipe, field, value)
        
        self.db.commit()
        
        return self._load_recipe_with_relations(recipe.id)
    
    def delete(self, user_id: int, recipe_id: int) -> bool:
        """Delete a recipe."""
        recipe = self.db.query(Recipe).filter(
            Recipe.id == recipe_id,
            Recipe.user_id == user_id,
        ).first()
        
        if recipe is None:
            return False
        
        # Check if used as sub-recipe
        used_in = self.db.query(RecipeItem).filter(
            RecipeItem.sub_recipe_id == recipe_id
        ).first()
        
        if used_in:
            raise ValueError(f"Recipe is used as sub-recipe in other recipes")
        
        self.db.delete(recipe)
        self.db.commit()
        
        return True
    
    def add_item(
        self,
        user_id: int,
        recipe_id: int,
        item_data: RecipeItemCreate,
    ) -> Optional[RecipeItem]:
        """Add an item to a recipe."""
        recipe = self.get(user_id, recipe_id)
        if recipe is None:
            return None
        
        # Validate references
        if item_data.ingredient_id:
            ingredient = self.db.query(Ingredient).filter(
                Ingredient.id == item_data.ingredient_id,
                Ingredient.user_id == user_id,
            ).first()
            if ingredient is None:
                raise ValueError(f"Ingredient with id {item_data.ingredient_id} not found")
        
        if item_data.sub_recipe_id:
            sub_recipe = self.get(user_id, item_data.sub_recipe_id)
            if sub_recipe is None:
                raise ValueError(f"Sub-recipe with id {item_data.sub_recipe_id} not found")
            
            # Check for cycles
            if self._would_create_cycle(recipe_id, item_data.sub_recipe_id):
                raise RecipeCycleError(f"Adding this sub-recipe would create a cycle")
        
        item = RecipeItem(
            recipe_id=recipe_id,
            ingredient_id=item_data.ingredient_id,
            sub_recipe_id=item_data.sub_recipe_id,
            quantity=item_data.quantity,
            unit=item_data.unit,
            sort_order=item_data.sort_order,
            notes=item_data.notes,
        )
        
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        
        return item
    
    def remove_item(self, user_id: int, recipe_id: int, item_id: int) -> bool:
        """Remove an item from a recipe."""
        recipe = self.get(user_id, recipe_id)
        if recipe is None:
            return False
        
        item = self.db.query(RecipeItem).filter(
            RecipeItem.id == item_id,
            RecipeItem.recipe_id == recipe_id,
        ).first()
        
        if item is None:
            return False
        
        self.db.delete(item)
        self.db.commit()
        
        return True
    
    def _would_create_cycle(self, recipe_id: int, sub_recipe_id: int, visited: Set[int] = None) -> bool:
        """Check if adding sub_recipe_id to recipe_id would create a cycle."""
        if visited is None:
            visited = set()
        
        if sub_recipe_id == recipe_id:
            return True
        
        if sub_recipe_id in visited:
            return False
        
        visited.add(sub_recipe_id)
        
        # Check all sub-recipes of sub_recipe_id
        sub_recipe = self.db.query(Recipe).options(
            joinedload(Recipe.items)
        ).filter(Recipe.id == sub_recipe_id).first()
        
        if sub_recipe:
            for item in sub_recipe.items:
                if item.sub_recipe_id:
                    if self._would_create_cycle(recipe_id, item.sub_recipe_id, visited):
                        return True
        
        return False
    
    def calculate_costs(self, recipe: Recipe) -> dict:
        """Calculate all costs for a recipe."""
        result = {
            "total_cost": None,
            "cost_per_portion": None,
            "food_cost_pct": None,
            "item_costs": {},
        }
        
        try:
            result["total_cost"] = calculate_recipe_cost(recipe)
            result["cost_per_portion"] = calculate_cost_per_portion(recipe)
            result["food_cost_pct"] = calculate_food_cost_percentage(recipe)
            
            # Calculate individual item costs
            for item in recipe.items:
                try:
                    result["item_costs"][item.id] = calculate_recipe_item_cost(item)
                except CostCalculationError:
                    result["item_costs"][item.id] = None
                    
        except CostCalculationError:
            pass
        
        return result
    
    def scale_recipe(self, recipe: Recipe, target_portions: Decimal) -> dict:
        """Scale a recipe to target portions."""
        original_yield = Decimal(str(recipe.yield_qty))
        scale_factor = target_portions / original_yield
        
        scaled_items = []
        for item in recipe.items:
            scaled_qty = Decimal(str(item.quantity)) * scale_factor
            
            item_info = {
                "id": item.id,
                "quantity": scaled_qty,
                "unit": item.unit,
                "original_quantity": Decimal(str(item.quantity)),
            }
            
            if item.ingredient:
                item_info["name"] = item.ingredient.name
                item_info["type"] = "ingredient"
            elif item.sub_recipe:
                item_info["name"] = item.sub_recipe.name
                item_info["type"] = "sub_recipe"
            
            scaled_items.append(item_info)
        
        # Calculate scaled costs
        try:
            total_cost = calculate_recipe_cost(recipe, scale=scale_factor)
            cost_per_portion = total_cost / target_portions
        except CostCalculationError:
            total_cost = None
            cost_per_portion = None
        
        return {
            "recipe_id": recipe.id,
            "recipe_name": recipe.name,
            "original_yield": original_yield,
            "target_yield": target_portions,
            "scale_factor": scale_factor,
            "items": scaled_items,
            "total_cost": total_cost,
            "cost_per_portion": cost_per_portion,
        }
