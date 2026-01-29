"""
Database Models

SQLAlchemy ORM models for BOM application.
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Date,
    ForeignKey, Numeric, CheckConstraint, Index, JSON
)
from sqlalchemy.orm import DeclarativeBase, relationship, Mapped, mapped_column
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


class User(Base):
    """User model for authentication and multi-tenancy."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    api_key: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    ingredients: Mapped[List["Ingredient"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    recipes: Mapped[List["Recipe"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    ingredient_categories: Mapped[List["IngredientCategory"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    recipe_categories: Mapped[List["RecipeCategory"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    suppliers: Mapped[List["Supplier"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    boms: Mapped[List["BillOfMaterials"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class IngredientCategory(Base):
    """Category for organizing ingredients."""
    __tablename__ = "ingredient_categories"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="ingredient_categories")
    ingredients: Mapped[List["Ingredient"]] = relationship(back_populates="category")


class RecipeCategory(Base):
    """Category for organizing recipes."""
    __tablename__ = "recipe_categories"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="recipe_categories")
    recipes: Mapped[List["Recipe"]] = relationship(back_populates="category")


class Supplier(Base):
    """Supplier/vendor information."""
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_name: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    address: Mapped[Optional[str]] = mapped_column(Text)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="suppliers")
    ingredients: Mapped[List["Ingredient"]] = relationship(back_populates="supplier")


class Ingredient(Base):
    """Ingredient with cost and unit information."""
    __tablename__ = "ingredients"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("ingredient_categories.id"), index=True)
    supplier_id: Mapped[Optional[int]] = mapped_column(ForeignKey("suppliers.id"), index=True)
    
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # Purchase information
    purchase_unit: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., "case", "bag"
    purchase_qty: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)  # qty per purchase unit
    purchase_price: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)  # cost per purchase unit
    
    # Recipe unit conversion
    recipe_unit: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., "oz", "cup"
    conversion_factor: Mapped[Decimal] = mapped_column(Numeric(10, 6), nullable=False)  # recipe_units per purchase_unit
    
    # Yield
    yield_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("100.00"))
    
    # Metadata
    allergens: Mapped[dict] = mapped_column(JSON, default=dict)  # {"contains": [], "may_contain": []}
    nutrition: Mapped[dict] = mapped_column(JSON, default=dict)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user: Mapped["User"] = relationship(back_populates="ingredients")
    category: Mapped[Optional["IngredientCategory"]] = relationship(back_populates="ingredients")
    supplier: Mapped[Optional["Supplier"]] = relationship(back_populates="ingredients")
    recipe_items: Mapped[List["RecipeItem"]] = relationship(back_populates="ingredient")
    price_history: Mapped[List["IngredientPriceHistory"]] = relationship(back_populates="ingredient", cascade="all, delete-orphan")


class IngredientPriceHistory(Base):
    """Historical price tracking for ingredients."""
    __tablename__ = "ingredient_price_history"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id"), nullable=False, index=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)
    effective_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(255))

    # Relationships
    ingredient: Mapped["Ingredient"] = relationship(back_populates="price_history")


class Recipe(Base):
    """Recipe with yield and cost information."""
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    category_id: Mapped[Optional[int]] = mapped_column(ForeignKey("recipe_categories.id"), index=True)
    
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    
    # Yield
    yield_qty: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)
    yield_unit: Mapped[str] = mapped_column(String(50), default="portion")
    
    # Time
    prep_time_min: Mapped[Optional[int]] = mapped_column(Integer)
    cook_time_min: Mapped[Optional[int]] = mapped_column(Integer)
    
    # Pricing
    selling_price: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))
    target_cost_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("30.00"))
    
    # Instructions
    instructions: Mapped[Optional[str]] = mapped_column(Text)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user: Mapped["User"] = relationship(back_populates="recipes")
    category: Mapped[Optional["RecipeCategory"]] = relationship(back_populates="recipes")
    items: Mapped[List["RecipeItem"]] = relationship(
        back_populates="recipe",
        foreign_keys="RecipeItem.recipe_id",
        cascade="all, delete-orphan"
    )
    # Sub-recipe references (where this recipe is used as ingredient)
    used_in_items: Mapped[List["RecipeItem"]] = relationship(
        back_populates="sub_recipe",
        foreign_keys="RecipeItem.sub_recipe_id"
    )


class RecipeItem(Base):
    """Line item in a recipe (ingredient or sub-recipe)."""
    __tablename__ = "recipe_items"
    __table_args__ = (
        CheckConstraint(
            "(ingredient_id IS NOT NULL AND sub_recipe_id IS NULL) OR "
            "(ingredient_id IS NULL AND sub_recipe_id IS NOT NULL)",
            name="check_ingredient_or_subrecipe"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    recipe_id: Mapped[int] = mapped_column(ForeignKey("recipes.id"), nullable=False, index=True)
    ingredient_id: Mapped[Optional[int]] = mapped_column(ForeignKey("ingredients.id"), index=True)
    sub_recipe_id: Mapped[Optional[int]] = mapped_column(ForeignKey("recipes.id"), index=True)
    
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[Optional[str]] = mapped_column(String(255))

    # Relationships
    recipe: Mapped["Recipe"] = relationship(back_populates="items", foreign_keys=[recipe_id])
    ingredient: Mapped[Optional["Ingredient"]] = relationship(back_populates="recipe_items")
    sub_recipe: Mapped[Optional["Recipe"]] = relationship(back_populates="used_in_items", foreign_keys=[sub_recipe_id])


class BillOfMaterials(Base):
    """Bill of Materials for production planning."""
    __tablename__ = "bill_of_materials"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    total_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 4))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user: Mapped["User"] = relationship(back_populates="boms")
    items: Mapped[List["BOMItem"]] = relationship(back_populates="bom", cascade="all, delete-orphan")


class BOMItem(Base):
    """Line item in a Bill of Materials."""
    __tablename__ = "bom_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    bom_id: Mapped[int] = mapped_column(ForeignKey("bill_of_materials.id"), nullable=False, index=True)
    recipe_id: Mapped[Optional[int]] = mapped_column(ForeignKey("recipes.id"), index=True)
    portions: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))
    ingredient_id: Mapped[Optional[int]] = mapped_column(ForeignKey("ingredients.id"), index=True)
    total_qty: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))
    unit: Mapped[Optional[str]] = mapped_column(String(50))
    unit_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))
    line_cost: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 4))

    # Relationships
    bom: Mapped["BillOfMaterials"] = relationship(back_populates="items")
    recipe: Mapped[Optional["Recipe"]] = relationship()
    ingredient: Mapped[Optional["Ingredient"]] = relationship()


class InventoryCount(Base):
    """Inventory count for tracking stock levels."""
    __tablename__ = "inventory_counts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    ingredient_id: Mapped[int] = mapped_column(ForeignKey("ingredients.id"), nullable=False, index=True)
    count_date: Mapped[date] = mapped_column(Date, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    # Relationships
    ingredient: Mapped["Ingredient"] = relationship()
