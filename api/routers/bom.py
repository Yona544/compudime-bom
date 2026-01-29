"""
BOM Router

API endpoints for Bill of Materials management.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from database.database import get_db
from api.schemas.bom import (
    BOMGenerateRequest,
    BOMResponse,
    BOMListSummaryResponse,
    BOMSummary,
)
from api.services.bom_service import BOMService
from api.dependencies import get_current_user_id

router = APIRouter(prefix="/api/v1/bom", tags=["Bill of Materials"])


def get_bom_service(db: Session = Depends(get_db)) -> BOMService:
    """Dependency to get BOM service."""
    return BOMService(db)


@router.post("/generate", response_model=BOMResponse, status_code=status.HTTP_201_CREATED)
def generate_bom(
    data: BOMGenerateRequest,
    user_id: int = Depends(get_current_user_id),
    service: BOMService = Depends(get_bom_service),
):
    """
    Generate a Bill of Materials from recipe requests.
    
    Aggregates all ingredients from the specified recipes and portions,
    combining quantities where the same ingredient appears multiple times.
    """
    try:
        bom = service.generate(user_id, data)
        return BOMResponse(**service.build_response_data(bom))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("", response_model=BOMListSummaryResponse)
def list_boms(
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    user_id: int = Depends(get_current_user_id),
    service: BOMService = Depends(get_bom_service),
):
    """
    List Bill of Materials with pagination.
    """
    items, total = service.list(user_id, offset, limit)
    
    summaries = [
        BOMSummary(
            id=bom.id,
            name=bom.name,
            date=bom.date,
            total_cost=bom.total_cost,
            recipe_count=len(set(i.recipe_id for i in bom.items if i.recipe_id)),
            ingredient_count=len([i for i in bom.items if i.ingredient_id]),
            created_at=bom.created_at,
        )
        for bom in items
    ]
    
    return BOMListSummaryResponse(
        items=summaries,
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get("/{bom_id}", response_model=BOMResponse)
def get_bom(
    bom_id: int,
    user_id: int = Depends(get_current_user_id),
    service: BOMService = Depends(get_bom_service),
):
    """
    Get a Bill of Materials by ID.
    """
    bom = service.get(user_id, bom_id)
    
    if bom is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"BOM with id {bom_id} not found",
        )
    
    return BOMResponse(**service.build_response_data(bom))


@router.delete("/{bom_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bom(
    bom_id: int,
    user_id: int = Depends(get_current_user_id),
    service: BOMService = Depends(get_bom_service),
):
    """
    Delete a Bill of Materials.
    """
    deleted = service.delete(user_id, bom_id)
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"BOM with id {bom_id} not found",
        )
    
    return None
