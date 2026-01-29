"""
BOM Schemas

Pydantic schemas for Bill of Materials API.
"""

from datetime import datetime
from datetime import date as date_type
from decimal import Decimal
from typing import Optional, List

from pydantic import BaseModel, Field, field_validator


class BOMRecipeRequest(BaseModel):
    """Request for a single recipe in BOM generation."""
    recipe_id: int = Field(..., description="Recipe ID")
    portions: Decimal = Field(..., gt=0, description="Number of portions to make")

    @field_validator("portions", mode="before")
    @classmethod
    def convert_portions(cls, v):
        if v is not None:
            return Decimal(str(v))
        return v


class BOMGenerateRequest(BaseModel):
    """Request to generate a Bill of Materials."""
    name: str = Field(..., min_length=1, max_length=255, description="BOM name")
    target_date: date_type = Field(..., alias="date", description="Target production date")
    recipes: List[BOMRecipeRequest] = Field(..., min_length=1, description="Recipes to include")
    
    model_config = {"populate_by_name": True}


class BOMIngredientLine(BaseModel):
    """A single ingredient line in the BOM."""
    ingredient_id: int
    ingredient_name: str
    total_qty: Decimal
    unit: str
    unit_cost: Optional[Decimal] = None
    line_cost: Optional[Decimal] = None
    
    # Source tracking
    from_recipes: List[dict] = Field(default_factory=list, description="Which recipes contributed")


class BOMItemResponse(BaseModel):
    """Response for a BOM item."""
    id: int
    bom_id: int
    recipe_id: Optional[int] = None
    recipe_name: Optional[str] = None
    portions: Optional[Decimal] = None
    ingredient_id: Optional[int] = None
    ingredient_name: Optional[str] = None
    total_qty: Optional[Decimal] = None
    unit: Optional[str] = None
    unit_cost: Optional[Decimal] = None
    line_cost: Optional[Decimal] = None

    model_config = {"from_attributes": True}


class BOMResponse(BaseModel):
    """Response for a Bill of Materials."""
    id: int
    user_id: int
    name: str
    date: date_type
    total_cost: Optional[Decimal] = None
    created_at: datetime
    
    # Recipe summary
    recipes: List[dict] = Field(default_factory=list, description="Recipes included")
    
    # Aggregated ingredient list
    ingredients: List[BOMIngredientLine] = Field(default_factory=list)
    
    # Detailed items
    items: List[BOMItemResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class BOMListResponse(BaseModel):
    """Paginated list of BOMs."""
    items: List[BOMResponse]
    total: int
    offset: int
    limit: int


class BOMSummary(BaseModel):
    """Summary of a BOM for list views."""
    id: int
    name: str
    date: date_type
    total_cost: Optional[Decimal] = None
    recipe_count: int
    ingredient_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class BOMListSummaryResponse(BaseModel):
    """Paginated list of BOM summaries."""
    items: List[BOMSummary]
    total: int
    offset: int
    limit: int
