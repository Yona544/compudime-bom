"""
Ingredients Router

API endpoints for ingredient management.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database.database import get_db
from api.schemas.ingredient import (
    IngredientCreate,
    IngredientUpdate,
    IngredientResponse,
    IngredientListResponse,
)
from api.services.ingredient_service import IngredientService
from api.dependencies import get_current_user_id

router = APIRouter(prefix="/api/v1/ingredients", tags=["Ingredients"])


def get_ingredient_service(db: Session = Depends(get_db)) -> IngredientService:
    """Dependency to get ingredient service."""
    return IngredientService(db)


@router.post("", response_model=IngredientResponse, status_code=status.HTTP_201_CREATED)
def create_ingredient(
    data: IngredientCreate,
    user_id: int = Depends(get_current_user_id),
    service: IngredientService = Depends(get_ingredient_service),
):
    """
    Create a new ingredient.
    
    Creates an ingredient with cost, unit, and metadata information.
    """
    ingredient = service.create(user_id, data)
    response = IngredientResponse.model_validate(ingredient)
    response.unit_cost = service.calculate_unit_cost(ingredient)
    return response


@router.get("", response_model=IngredientListResponse)
def list_ingredients(
    offset: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(20, ge=1, le=100, description="Number of items to return"),
    search: Optional[str] = Query(None, description="Search by name"),
    category_id: Optional[int] = Query(None, description="Filter by category"),
    user_id: int = Depends(get_current_user_id),
    service: IngredientService = Depends(get_ingredient_service),
):
    """
    List ingredients with pagination and filtering.
    
    Returns a paginated list of ingredients for the current user.
    """
    items, total = service.list(
        user_id=user_id,
        offset=offset,
        limit=limit,
        search=search,
        category_id=category_id,
    )
    
    # Convert to response with unit costs
    response_items = []
    for item in items:
        resp = IngredientResponse.model_validate(item)
        resp.unit_cost = service.calculate_unit_cost(item)
        response_items.append(resp)
    
    return IngredientListResponse(
        items=response_items,
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get("/{ingredient_id}", response_model=IngredientResponse)
def get_ingredient(
    ingredient_id: int,
    user_id: int = Depends(get_current_user_id),
    service: IngredientService = Depends(get_ingredient_service),
):
    """
    Get an ingredient by ID.
    
    Returns the ingredient details including calculated unit cost.
    """
    ingredient = service.get(user_id, ingredient_id)
    
    if ingredient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ingredient with id {ingredient_id} not found",
        )
    
    response = IngredientResponse.model_validate(ingredient)
    response.unit_cost = service.calculate_unit_cost(ingredient)
    return response


@router.patch("/{ingredient_id}", response_model=IngredientResponse)
def update_ingredient(
    ingredient_id: int,
    data: IngredientUpdate,
    user_id: int = Depends(get_current_user_id),
    service: IngredientService = Depends(get_ingredient_service),
):
    """
    Update an ingredient.
    
    Partial update - only provided fields are updated.
    """
    ingredient = service.update(user_id, ingredient_id, data)
    
    if ingredient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ingredient with id {ingredient_id} not found",
        )
    
    response = IngredientResponse.model_validate(ingredient)
    response.unit_cost = service.calculate_unit_cost(ingredient)
    return response


@router.delete("/{ingredient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ingredient(
    ingredient_id: int,
    user_id: int = Depends(get_current_user_id),
    service: IngredientService = Depends(get_ingredient_service),
):
    """
    Delete an ingredient.
    
    Permanently removes the ingredient.
    """
    deleted = service.delete(user_id, ingredient_id)
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ingredient with id {ingredient_id} not found",
        )
    
    return None
