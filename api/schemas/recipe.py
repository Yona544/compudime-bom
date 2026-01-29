"""
Recipe Schemas

Pydantic schemas for recipe API.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, Field, field_validator, model_validator


class RecipeItemBase(BaseModel):
    """Base recipe item fields."""
    ingredient_id: Optional[int] = Field(None, description="Ingredient ID (mutually exclusive with sub_recipe_id)")
    sub_recipe_id: Optional[int] = Field(None, description="Sub-recipe ID (mutually exclusive with ingredient_id)")
    quantity: Decimal = Field(..., gt=0, description="Amount used")
    unit: str = Field(..., min_length=1, max_length=50, description="Unit of measure")
    sort_order: int = Field(default=0, description="Display order")
    notes: Optional[str] = Field(None, max_length=255, description="Line notes")

    @field_validator("quantity", mode="before")
    @classmethod
    def convert_quantity(cls, v):
        if v is not None:
            return Decimal(str(v))
        return v

    @model_validator(mode="after")
    def check_ingredient_or_subrecipe(self):
        """Ensure exactly one of ingredient_id or sub_recipe_id is set."""
        if self.ingredient_id is None and self.sub_recipe_id is None:
            raise ValueError("Either ingredient_id or sub_recipe_id must be provided")
        if self.ingredient_id is not None and self.sub_recipe_id is not None:
            raise ValueError("Cannot specify both ingredient_id and sub_recipe_id")
        return self


class RecipeItemCreate(RecipeItemBase):
    """Schema for creating a recipe item."""
    pass


class RecipeItemUpdate(BaseModel):
    """Schema for updating a recipe item."""
    ingredient_id: Optional[int] = None
    sub_recipe_id: Optional[int] = None
    quantity: Optional[Decimal] = Field(None, gt=0)
    unit: Optional[str] = Field(None, min_length=1, max_length=50)
    sort_order: Optional[int] = None
    notes: Optional[str] = Field(None, max_length=255)

    @field_validator("quantity", mode="before")
    @classmethod
    def convert_quantity(cls, v):
        if v is not None:
            return Decimal(str(v))
        return v


class RecipeItemResponse(RecipeItemBase):
    """Schema for recipe item response."""
    id: int
    recipe_id: int
    # Computed fields
    item_cost: Optional[Decimal] = Field(None, description="Cost for this line item")
    ingredient_name: Optional[str] = Field(None, description="Ingredient name if applicable")
    sub_recipe_name: Optional[str] = Field(None, description="Sub-recipe name if applicable")

    model_config = {"from_attributes": True}


class RecipeBase(BaseModel):
    """Base recipe fields."""
    name: str = Field(..., min_length=1, max_length=255, description="Recipe name")
    description: Optional[str] = Field(None, description="Notes or description")
    
    # Yield
    yield_qty: Decimal = Field(..., gt=0, description="Number of portions/servings")
    yield_unit: str = Field(default="portion", max_length=50, description="Yield unit (e.g., 'portion', 'dozen')")
    
    # Time
    prep_time_min: Optional[int] = Field(None, ge=0, description="Prep time in minutes")
    cook_time_min: Optional[int] = Field(None, ge=0, description="Cook time in minutes")
    
    # Pricing
    selling_price: Optional[Decimal] = Field(None, ge=0, description="Sale price per yield unit")
    target_cost_pct: Decimal = Field(default=Decimal("30.00"), ge=0, le=100, description="Target food cost %")
    
    # Category
    category_id: Optional[int] = Field(None, description="Category ID")
    
    # Instructions
    instructions: Optional[str] = Field(None, description="Preparation instructions")

    @field_validator("yield_qty", "selling_price", "target_cost_pct", mode="before")
    @classmethod
    def convert_to_decimal(cls, v):
        if v is not None:
            return Decimal(str(v))
        return v


class RecipeCreate(RecipeBase):
    """Schema for creating a recipe."""
    items: List[RecipeItemCreate] = Field(default_factory=list, description="Recipe ingredients/sub-recipes")


class RecipeUpdate(BaseModel):
    """Schema for updating a recipe (all fields optional)."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    yield_qty: Optional[Decimal] = Field(None, gt=0)
    yield_unit: Optional[str] = Field(None, max_length=50)
    prep_time_min: Optional[int] = Field(None, ge=0)
    cook_time_min: Optional[int] = Field(None, ge=0)
    selling_price: Optional[Decimal] = Field(None, ge=0)
    target_cost_pct: Optional[Decimal] = Field(None, ge=0, le=100)
    category_id: Optional[int] = None
    instructions: Optional[str] = None

    @field_validator("yield_qty", "selling_price", "target_cost_pct", mode="before")
    @classmethod
    def convert_to_decimal(cls, v):
        if v is not None:
            return Decimal(str(v))
        return v


class RecipeResponse(RecipeBase):
    """Schema for recipe response."""
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    # Items
    items: List[RecipeItemResponse] = Field(default_factory=list)
    
    # Computed fields
    total_cost: Optional[Decimal] = Field(None, description="Total recipe cost")
    cost_per_portion: Optional[Decimal] = Field(None, description="Cost per yield unit")
    food_cost_pct: Optional[Decimal] = Field(None, description="Actual food cost %")

    model_config = {"from_attributes": True}


class RecipeListResponse(BaseModel):
    """Paginated list of recipes."""
    items: List[RecipeResponse]
    total: int
    offset: int
    limit: int


class RecipeScaleRequest(BaseModel):
    """Request to scale a recipe."""
    portions: Decimal = Field(..., gt=0, description="Target number of portions")

    @field_validator("portions", mode="before")
    @classmethod
    def convert_portions(cls, v):
        if v is not None:
            return Decimal(str(v))
        return v


class RecipeScaleResponse(BaseModel):
    """Scaled recipe response."""
    recipe_id: int
    recipe_name: str
    original_yield: Decimal
    target_yield: Decimal
    scale_factor: Decimal
    items: List[dict]  # Scaled items with quantities
    total_cost: Decimal
    cost_per_portion: Decimal
