"""
Ingredient Schemas

Pydantic schemas for ingredient API.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field, field_validator


class AllergenInfo(BaseModel):
    """Allergen information."""
    contains: List[str] = Field(default_factory=list)
    may_contain: List[str] = Field(default_factory=list)


class NutritionInfo(BaseModel):
    """Nutrition information per serving."""
    serving_size: Optional[str] = None
    calories: Optional[float] = None
    total_fat_g: Optional[float] = None
    saturated_fat_g: Optional[float] = None
    cholesterol_mg: Optional[float] = None
    sodium_mg: Optional[float] = None
    total_carbs_g: Optional[float] = None
    dietary_fiber_g: Optional[float] = None
    sugars_g: Optional[float] = None
    protein_g: Optional[float] = None


class IngredientBase(BaseModel):
    """Base ingredient fields."""
    name: str = Field(..., min_length=1, max_length=255, description="Ingredient name")
    description: Optional[str] = Field(None, description="Notes or description")
    
    # Purchase info
    purchase_unit: str = Field(..., min_length=1, max_length=50, description="Purchase unit (e.g., 'case', 'bag')")
    purchase_qty: Decimal = Field(..., gt=0, description="Quantity per purchase unit")
    purchase_price: Decimal = Field(..., ge=0, description="Cost per purchase unit")
    
    # Recipe unit conversion
    recipe_unit: str = Field(..., min_length=1, max_length=50, description="Recipe unit (e.g., 'oz', 'cup')")
    conversion_factor: Decimal = Field(..., gt=0, description="Recipe units per purchase unit")
    
    # Yield
    yield_percent: Decimal = Field(default=Decimal("100.00"), ge=0, le=100, description="Usable yield percentage")
    
    # Category and supplier (optional)
    category_id: Optional[int] = Field(None, description="Category ID")
    supplier_id: Optional[int] = Field(None, description="Supplier ID")

    @field_validator("purchase_qty", "purchase_price", "conversion_factor", "yield_percent", mode="before")
    @classmethod
    def convert_to_decimal(cls, v):
        if v is not None:
            return Decimal(str(v))
        return v


class IngredientCreate(IngredientBase):
    """Schema for creating an ingredient."""
    allergens: Optional[AllergenInfo] = Field(default_factory=AllergenInfo)
    nutrition: Optional[NutritionInfo] = Field(default_factory=NutritionInfo)


class IngredientUpdate(BaseModel):
    """Schema for updating an ingredient (all fields optional)."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    purchase_unit: Optional[str] = Field(None, min_length=1, max_length=50)
    purchase_qty: Optional[Decimal] = Field(None, gt=0)
    purchase_price: Optional[Decimal] = Field(None, ge=0)
    recipe_unit: Optional[str] = Field(None, min_length=1, max_length=50)
    conversion_factor: Optional[Decimal] = Field(None, gt=0)
    yield_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    category_id: Optional[int] = None
    supplier_id: Optional[int] = None
    allergens: Optional[AllergenInfo] = None
    nutrition: Optional[NutritionInfo] = None

    @field_validator("purchase_qty", "purchase_price", "conversion_factor", "yield_percent", mode="before")
    @classmethod
    def convert_to_decimal(cls, v):
        if v is not None:
            return Decimal(str(v))
        return v


class IngredientResponse(IngredientBase):
    """Schema for ingredient response."""
    id: int
    user_id: int
    allergens: Dict[str, Any] = Field(default_factory=dict)
    nutrition: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Computed fields
    unit_cost: Optional[Decimal] = Field(None, description="Cost per recipe unit")
    
    model_config = {"from_attributes": True}


class IngredientListResponse(BaseModel):
    """Paginated list of ingredients."""
    items: List[IngredientResponse]
    total: int
    offset: int
    limit: int
