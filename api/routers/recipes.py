"""
Recipes Router

API endpoints for recipe management.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database.database import get_db
from api.schemas.recipe import (
    RecipeCreate,
    RecipeUpdate,
    RecipeResponse,
    RecipeListResponse,
    RecipeItemCreate,
    RecipeItemResponse,
    RecipeScaleRequest,
    RecipeScaleResponse,
)
from api.services.recipe_service import RecipeService
from api.services.cost_calculator import RecipeCycleError
from api.dependencies import get_current_user_id

router = APIRouter(prefix="/api/v1/recipes", tags=["Recipes"])


def get_recipe_service(db: Session = Depends(get_db)) -> RecipeService:
    """Dependency to get recipe service."""
    return RecipeService(db)


def _build_recipe_response(recipe, service: RecipeService) -> RecipeResponse:
    """Build a recipe response with computed costs."""
    costs = service.calculate_costs(recipe)
    
    # Build item responses
    items = []
    for item in recipe.items:
        item_resp = RecipeItemResponse(
            id=item.id,
            recipe_id=item.recipe_id,
            ingredient_id=item.ingredient_id,
            sub_recipe_id=item.sub_recipe_id,
            quantity=item.quantity,
            unit=item.unit,
            sort_order=item.sort_order,
            notes=item.notes,
            item_cost=costs["item_costs"].get(item.id),
            ingredient_name=item.ingredient.name if item.ingredient else None,
            sub_recipe_name=item.sub_recipe.name if item.sub_recipe else None,
        )
        items.append(item_resp)
    
    return RecipeResponse(
        id=recipe.id,
        user_id=recipe.user_id,
        name=recipe.name,
        description=recipe.description,
        yield_qty=recipe.yield_qty,
        yield_unit=recipe.yield_unit,
        prep_time_min=recipe.prep_time_min,
        cook_time_min=recipe.cook_time_min,
        selling_price=recipe.selling_price,
        target_cost_pct=recipe.target_cost_pct,
        category_id=recipe.category_id,
        instructions=recipe.instructions,
        created_at=recipe.created_at,
        updated_at=recipe.updated_at,
        items=items,
        total_cost=costs["total_cost"],
        cost_per_portion=costs["cost_per_portion"],
        food_cost_pct=costs["food_cost_pct"],
    )


@router.post("", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
def create_recipe(
    data: RecipeCreate,
    user_id: int = Depends(get_current_user_id),
    service: RecipeService = Depends(get_recipe_service),
):
    """
    Create a new recipe.
    
    Creates a recipe with ingredients and/or sub-recipes.
    """
    try:
        recipe = service.create(user_id, data)
        return _build_recipe_response(recipe, service)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RecipeCycleError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=RecipeListResponse)
def list_recipes(
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    user_id: int = Depends(get_current_user_id),
    service: RecipeService = Depends(get_recipe_service),
):
    """
    List recipes with pagination and filtering.
    """
    items, total = service.list(
        user_id=user_id,
        offset=offset,
        limit=limit,
        search=search,
        category_id=category_id,
    )
    
    response_items = [_build_recipe_response(r, service) for r in items]
    
    return RecipeListResponse(
        items=response_items,
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get("/{recipe_id}", response_model=RecipeResponse)
def get_recipe(
    recipe_id: int,
    user_id: int = Depends(get_current_user_id),
    service: RecipeService = Depends(get_recipe_service),
):
    """
    Get a recipe by ID.
    """
    recipe = service.get(user_id, recipe_id)
    
    if recipe is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recipe with id {recipe_id} not found",
        )
    
    return _build_recipe_response(recipe, service)


@router.patch("/{recipe_id}", response_model=RecipeResponse)
def update_recipe(
    recipe_id: int,
    data: RecipeUpdate,
    user_id: int = Depends(get_current_user_id),
    service: RecipeService = Depends(get_recipe_service),
):
    """
    Update a recipe.
    
    Partial update - only provided fields are updated.
    """
    recipe = service.update(user_id, recipe_id, data)
    
    if recipe is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recipe with id {recipe_id} not found",
        )
    
    return _build_recipe_response(recipe, service)


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(
    recipe_id: int,
    user_id: int = Depends(get_current_user_id),
    service: RecipeService = Depends(get_recipe_service),
):
    """
    Delete a recipe.
    """
    try:
        deleted = service.delete(user_id, recipe_id)
        
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recipe with id {recipe_id} not found",
            )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    
    return None


@router.post("/{recipe_id}/items", response_model=RecipeItemResponse, status_code=status.HTTP_201_CREATED)
def add_recipe_item(
    recipe_id: int,
    item_data: RecipeItemCreate,
    user_id: int = Depends(get_current_user_id),
    service: RecipeService = Depends(get_recipe_service),
):
    """
    Add an item (ingredient or sub-recipe) to a recipe.
    """
    try:
        item = service.add_item(user_id, recipe_id, item_data)
        
        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recipe with id {recipe_id} not found",
            )
        
        # Build response
        return RecipeItemResponse(
            id=item.id,
            recipe_id=item.recipe_id,
            ingredient_id=item.ingredient_id,
            sub_recipe_id=item.sub_recipe_id,
            quantity=item.quantity,
            unit=item.unit,
            sort_order=item.sort_order,
            notes=item.notes,
            item_cost=None,  # Would need to recalculate
            ingredient_name=None,
            sub_recipe_name=None,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except RecipeCycleError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{recipe_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_recipe_item(
    recipe_id: int,
    item_id: int,
    user_id: int = Depends(get_current_user_id),
    service: RecipeService = Depends(get_recipe_service),
):
    """
    Remove an item from a recipe.
    """
    removed = service.remove_item(user_id, recipe_id, item_id)
    
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recipe or item not found",
        )
    
    return None


@router.post("/{recipe_id}/scale", response_model=RecipeScaleResponse)
def scale_recipe(
    recipe_id: int,
    data: RecipeScaleRequest,
    user_id: int = Depends(get_current_user_id),
    service: RecipeService = Depends(get_recipe_service),
):
    """
    Scale a recipe to a target number of portions.
    
    Returns the scaled ingredient quantities and costs.
    """
    recipe = service.get(user_id, recipe_id)
    
    if recipe is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recipe with id {recipe_id} not found",
        )
    
    scaled = service.scale_recipe(recipe, data.portions)
    
    return RecipeScaleResponse(**scaled)


@router.get("/{recipe_id}/cost")
def get_recipe_cost(
    recipe_id: int,
    portions: Optional[float] = Query(None, gt=0, description="Calculate for specific portions"),
    user_id: int = Depends(get_current_user_id),
    service: RecipeService = Depends(get_recipe_service),
):
    """
    Get detailed cost breakdown for a recipe.
    """
    recipe = service.get(user_id, recipe_id)
    
    if recipe is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recipe with id {recipe_id} not found",
        )
    
    costs = service.calculate_costs(recipe)
    
    return {
        "recipe_id": recipe.id,
        "recipe_name": recipe.name,
        "yield_qty": recipe.yield_qty,
        "yield_unit": recipe.yield_unit,
        "total_cost": costs["total_cost"],
        "cost_per_portion": costs["cost_per_portion"],
        "food_cost_pct": costs["food_cost_pct"],
        "target_cost_pct": recipe.target_cost_pct,
        "selling_price": recipe.selling_price,
        "items": [
            {
                "id": item.id,
                "name": item.ingredient.name if item.ingredient else item.sub_recipe.name,
                "type": "ingredient" if item.ingredient else "sub_recipe",
                "quantity": item.quantity,
                "unit": item.unit,
                "cost": costs["item_costs"].get(item.id),
            }
            for item in recipe.items
        ],
    }
