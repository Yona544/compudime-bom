"""
BOM Service

Business logic for Bill of Materials operations.
"""

from decimal import Decimal
from typing import Optional, List, Tuple, Dict
from collections import defaultdict

from sqlalchemy.orm import Session, joinedload

from database.models import BillOfMaterials, BOMItem, Recipe, RecipeItem, Ingredient
from api.schemas.bom import BOMGenerateRequest, BOMRecipeRequest
from api.services.cost_calculator import (
    get_ingredient_unit_cost,
    calculate_recipe_cost,
    CostCalculationError,
)


class BOMService:
    """Service for BOM operations."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def generate(self, user_id: int, data: BOMGenerateRequest) -> BillOfMaterials:
        """
        Generate a Bill of Materials from recipe requests.
        
        This aggregates all ingredients from the requested recipes,
        combining quantities where the same ingredient appears multiple times.
        """
        # Validate all recipes exist
        recipe_map = {}
        for req in data.recipes:
            recipe = self._get_recipe_with_items(user_id, req.recipe_id)
            if recipe is None:
                raise ValueError(f"Recipe with id {req.recipe_id} not found")
            recipe_map[req.recipe_id] = recipe
        
        # Create BOM
        bom = BillOfMaterials(
            user_id=user_id,
            name=data.name,
            date=data.target_date,
            total_cost=Decimal("0"),
        )
        self.db.add(bom)
        self.db.flush()
        
        # Aggregate ingredients from all recipes
        aggregated = self._aggregate_ingredients(recipe_map, data.recipes, user_id)
        
        # Create BOM items for the aggregated ingredients
        total_cost = Decimal("0")
        
        for ing_id, agg_data in aggregated.items():
            line_cost = None
            if agg_data["unit_cost"] is not None:
                line_cost = agg_data["total_qty"] * agg_data["unit_cost"]
                total_cost += line_cost
            
            item = BOMItem(
                bom_id=bom.id,
                ingredient_id=ing_id,
                total_qty=agg_data["total_qty"],
                unit=agg_data["unit"],
                unit_cost=agg_data["unit_cost"],
                line_cost=line_cost,
            )
            self.db.add(item)
        
        # Update total cost
        bom.total_cost = total_cost
        
        self.db.commit()
        self.db.refresh(bom)
        
        return self._load_bom_with_relations(bom.id)
    
    def _get_recipe_with_items(self, user_id: int, recipe_id: int) -> Optional[Recipe]:
        """Load a recipe with all items and their ingredients."""
        return self.db.query(Recipe).options(
            joinedload(Recipe.items).joinedload(RecipeItem.ingredient),
            joinedload(Recipe.items).joinedload(RecipeItem.sub_recipe).joinedload(Recipe.items).joinedload(RecipeItem.ingredient),
        ).filter(
            Recipe.id == recipe_id,
            Recipe.user_id == user_id,
        ).first()
    
    def _aggregate_ingredients(
        self,
        recipe_map: Dict[int, Recipe],
        requests: List[BOMRecipeRequest],
        user_id: int,
    ) -> Dict[int, dict]:
        """
        Aggregate ingredients from all recipe requests.
        
        Returns dict of ingredient_id -> {total_qty, unit, unit_cost, sources}
        """
        aggregated: Dict[int, dict] = defaultdict(lambda: {
            "total_qty": Decimal("0"),
            "unit": None,
            "unit_cost": None,
            "ingredient_name": None,
            "sources": [],
        })
        
        for req in requests:
            recipe = recipe_map[req.recipe_id]
            scale = req.portions / Decimal(str(recipe.yield_qty))
            
            # Flatten recipe (expand sub-recipes) and aggregate
            self._flatten_recipe_items(
                recipe,
                scale,
                aggregated,
                source_recipe=recipe.name,
            )
        
        return aggregated
    
    def _flatten_recipe_items(
        self,
        recipe: Recipe,
        scale: Decimal,
        aggregated: Dict[int, dict],
        source_recipe: str,
        visited: set = None,
    ) -> None:
        """
        Recursively flatten recipe items, expanding sub-recipes.
        
        Adds ingredients to the aggregated dict with scaled quantities.
        """
        if visited is None:
            visited = set()
        
        if recipe.id in visited:
            return  # Prevent infinite recursion
        
        visited.add(recipe.id)
        
        for item in recipe.items:
            if item.ingredient_id and item.ingredient:
                # Direct ingredient
                ing = item.ingredient
                qty = Decimal(str(item.quantity)) * scale
                
                # Get or initialize aggregation
                agg = aggregated[ing.id]
                agg["total_qty"] += qty
                agg["unit"] = item.unit
                agg["ingredient_name"] = ing.name
                
                # Calculate unit cost if not already done
                if agg["unit_cost"] is None:
                    try:
                        agg["unit_cost"] = get_ingredient_unit_cost(ing, item.unit)
                    except CostCalculationError:
                        agg["unit_cost"] = None
                
                agg["sources"].append({
                    "recipe": source_recipe,
                    "qty": qty,
                })
            
            elif item.sub_recipe_id and item.sub_recipe:
                # Sub-recipe - recurse
                sub_recipe = item.sub_recipe
                sub_yield = Decimal(str(sub_recipe.yield_qty))
                sub_qty = Decimal(str(item.quantity))
                
                # Scale factor for sub-recipe
                sub_scale = (sub_qty / sub_yield) * scale
                
                self._flatten_recipe_items(
                    sub_recipe,
                    sub_scale,
                    aggregated,
                    source_recipe=source_recipe,
                    visited=visited.copy(),
                )
    
    def get(self, user_id: int, bom_id: int) -> Optional[BillOfMaterials]:
        """Get a BOM by ID."""
        return self._load_bom_with_relations(bom_id, user_id)
    
    def _load_bom_with_relations(self, bom_id: int, user_id: int = None) -> Optional[BillOfMaterials]:
        """Load BOM with all relations."""
        query = self.db.query(BillOfMaterials).options(
            joinedload(BillOfMaterials.items).joinedload(BOMItem.ingredient),
            joinedload(BillOfMaterials.items).joinedload(BOMItem.recipe),
        ).filter(BillOfMaterials.id == bom_id)
        
        if user_id:
            query = query.filter(BillOfMaterials.user_id == user_id)
        
        return query.first()
    
    def list(
        self,
        user_id: int,
        offset: int = 0,
        limit: int = 20,
    ) -> Tuple[List[BillOfMaterials], int]:
        """List BOMs with pagination."""
        query = self.db.query(BillOfMaterials).filter(
            BillOfMaterials.user_id == user_id
        )
        
        total = query.count()
        
        bom_ids = [b.id for b in query.order_by(
            BillOfMaterials.date.desc()
        ).offset(offset).limit(limit).all()]
        
        if bom_ids:
            items = self.db.query(BillOfMaterials).options(
                joinedload(BillOfMaterials.items).joinedload(BOMItem.ingredient),
            ).filter(BillOfMaterials.id.in_(bom_ids)).all()
            
            # Sort to match original order
            items_dict = {b.id: b for b in items}
            items = [items_dict[bid] for bid in bom_ids]
        else:
            items = []
        
        return items, total
    
    def delete(self, user_id: int, bom_id: int) -> bool:
        """Delete a BOM."""
        bom = self.db.query(BillOfMaterials).filter(
            BillOfMaterials.id == bom_id,
            BillOfMaterials.user_id == user_id,
        ).first()
        
        if bom is None:
            return False
        
        self.db.delete(bom)
        self.db.commit()
        
        return True
    
    def build_response_data(self, bom: BillOfMaterials) -> dict:
        """Build response data for a BOM."""
        ingredients = []
        for item in bom.items:
            if item.ingredient:
                ingredients.append({
                    "ingredient_id": item.ingredient_id,
                    "ingredient_name": item.ingredient.name,
                    "total_qty": item.total_qty,
                    "unit": item.unit,
                    "unit_cost": item.unit_cost,
                    "line_cost": item.line_cost,
                    "from_recipes": [],  # Could be populated if we tracked sources
                })
        
        return {
            "id": bom.id,
            "user_id": bom.user_id,
            "name": bom.name,
            "date": bom.date,
            "total_cost": bom.total_cost,
            "created_at": bom.created_at,
            "recipes": [],  # Would need to store recipe requests
            "ingredients": ingredients,
            "items": [
                {
                    "id": item.id,
                    "bom_id": item.bom_id,
                    "recipe_id": item.recipe_id,
                    "recipe_name": item.recipe.name if item.recipe else None,
                    "portions": item.portions,
                    "ingredient_id": item.ingredient_id,
                    "ingredient_name": item.ingredient.name if item.ingredient else None,
                    "total_qty": item.total_qty,
                    "unit": item.unit,
                    "unit_cost": item.unit_cost,
                    "line_cost": item.line_cost,
                }
                for item in bom.items
            ],
        }
