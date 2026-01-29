"""
Ingredient Service

Business logic for ingredient operations.
"""

from decimal import Decimal
from typing import Optional, List, Tuple

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from database.models import Ingredient
from api.schemas.ingredient import IngredientCreate, IngredientUpdate
from .cost_calculator import get_ingredient_unit_cost, CostCalculationError


class IngredientService:
    """Service for ingredient CRUD operations."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def create(self, user_id: int, data: IngredientCreate) -> Ingredient:
        """Create a new ingredient."""
        ingredient = Ingredient(
            user_id=user_id,
            name=data.name,
            description=data.description,
            purchase_unit=data.purchase_unit,
            purchase_qty=data.purchase_qty,
            purchase_price=data.purchase_price,
            recipe_unit=data.recipe_unit,
            conversion_factor=data.conversion_factor,
            yield_percent=data.yield_percent,
            category_id=data.category_id,
            supplier_id=data.supplier_id,
            allergens=data.allergens.model_dump() if data.allergens else {},
            nutrition=data.nutrition.model_dump() if data.nutrition else {},
        )
        
        self.db.add(ingredient)
        self.db.commit()
        self.db.refresh(ingredient)
        
        return ingredient
    
    def get(self, user_id: int, ingredient_id: int) -> Optional[Ingredient]:
        """Get an ingredient by ID (scoped to user)."""
        return self.db.query(Ingredient).filter(
            Ingredient.id == ingredient_id,
            Ingredient.user_id == user_id,
        ).first()
    
    def list(
        self,
        user_id: int,
        offset: int = 0,
        limit: int = 20,
        search: Optional[str] = None,
        category_id: Optional[int] = None,
    ) -> Tuple[List[Ingredient], int]:
        """
        List ingredients with pagination and filtering.
        
        Returns:
            Tuple of (items, total_count)
        """
        query = self.db.query(Ingredient).filter(Ingredient.user_id == user_id)
        
        # Apply filters
        if search:
            query = query.filter(Ingredient.name.ilike(f"%{search}%"))
        
        if category_id is not None:
            query = query.filter(Ingredient.category_id == category_id)
        
        # Get total count
        total = query.count()
        
        # Apply pagination
        items = query.order_by(Ingredient.name).offset(offset).limit(limit).all()
        
        return items, total
    
    def update(
        self,
        user_id: int,
        ingredient_id: int,
        data: IngredientUpdate,
    ) -> Optional[Ingredient]:
        """Update an ingredient (partial update)."""
        ingredient = self.get(user_id, ingredient_id)
        
        if ingredient is None:
            return None
        
        # Update only provided fields
        update_data = data.model_dump(exclude_unset=True)
        
        for field, value in update_data.items():
            if field == "allergens" and value is not None:
                value = value.model_dump() if hasattr(value, "model_dump") else value
            elif field == "nutrition" and value is not None:
                value = value.model_dump() if hasattr(value, "model_dump") else value
            
            setattr(ingredient, field, value)
        
        self.db.commit()
        self.db.refresh(ingredient)
        
        return ingredient
    
    def delete(self, user_id: int, ingredient_id: int) -> bool:
        """Delete an ingredient. Returns True if deleted, False if not found."""
        ingredient = self.get(user_id, ingredient_id)
        
        if ingredient is None:
            return False
        
        self.db.delete(ingredient)
        self.db.commit()
        
        return True
    
    def calculate_unit_cost(self, ingredient: Ingredient) -> Optional[Decimal]:
        """Calculate the cost per recipe unit for an ingredient."""
        try:
            return get_ingredient_unit_cost(ingredient)
        except CostCalculationError:
            return None
