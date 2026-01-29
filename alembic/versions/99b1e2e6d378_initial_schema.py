"""Initial schema

Revision ID: 99b1e2e6d378
Revises: 
Create Date: 2026-01-28 22:59:58.787471

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '99b1e2e6d378'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all tables."""
    # Users
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False, index=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('api_key', sa.String(64), unique=True, index=True),
        sa.Column('settings', sa.JSON(), default=dict),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    
    # Ingredient Categories
    op.create_table(
        'ingredient_categories',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('sort_order', sa.Integer(), default=0),
    )
    
    # Recipe Categories
    op.create_table(
        'recipe_categories',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('sort_order', sa.Integer(), default=0),
    )
    
    # Suppliers
    op.create_table(
        'suppliers',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('contact_name', sa.String(255)),
        sa.Column('phone', sa.String(50)),
        sa.Column('email', sa.String(255)),
        sa.Column('address', sa.Text()),
    )
    
    # Ingredients
    op.create_table(
        'ingredients',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('ingredient_categories.id'), index=True),
        sa.Column('supplier_id', sa.Integer(), sa.ForeignKey('suppliers.id'), index=True),
        sa.Column('name', sa.String(255), nullable=False, index=True),
        sa.Column('description', sa.Text()),
        sa.Column('purchase_unit', sa.String(50), nullable=False),
        sa.Column('purchase_qty', sa.Numeric(10, 4), nullable=False),
        sa.Column('purchase_price', sa.Numeric(10, 4), nullable=False),
        sa.Column('recipe_unit', sa.String(50), nullable=False),
        sa.Column('conversion_factor', sa.Numeric(10, 6), nullable=False),
        sa.Column('yield_percent', sa.Numeric(5, 2), default=100.00),
        sa.Column('allergens', sa.JSON(), default=dict),
        sa.Column('nutrition', sa.JSON(), default=dict),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    
    # Ingredient Price History
    op.create_table(
        'ingredient_price_history',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('ingredient_id', sa.Integer(), sa.ForeignKey('ingredients.id'), nullable=False, index=True),
        sa.Column('price', sa.Numeric(10, 4), nullable=False),
        sa.Column('effective_date', sa.Date(), nullable=False),
        sa.Column('notes', sa.String(255)),
    )
    
    # Recipes
    op.create_table(
        'recipes',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('recipe_categories.id'), index=True),
        sa.Column('name', sa.String(255), nullable=False, index=True),
        sa.Column('description', sa.Text()),
        sa.Column('yield_qty', sa.Numeric(10, 4), nullable=False),
        sa.Column('yield_unit', sa.String(50), default='portion'),
        sa.Column('prep_time_min', sa.Integer()),
        sa.Column('cook_time_min', sa.Integer()),
        sa.Column('selling_price', sa.Numeric(10, 4)),
        sa.Column('target_cost_pct', sa.Numeric(5, 2), default=30.00),
        sa.Column('instructions', sa.Text()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    
    # Recipe Items
    op.create_table(
        'recipe_items',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('recipe_id', sa.Integer(), sa.ForeignKey('recipes.id'), nullable=False, index=True),
        sa.Column('ingredient_id', sa.Integer(), sa.ForeignKey('ingredients.id'), index=True),
        sa.Column('sub_recipe_id', sa.Integer(), sa.ForeignKey('recipes.id'), index=True),
        sa.Column('quantity', sa.Numeric(10, 4), nullable=False),
        sa.Column('unit', sa.String(50), nullable=False),
        sa.Column('sort_order', sa.Integer(), default=0),
        sa.Column('notes', sa.String(255)),
        sa.CheckConstraint(
            '(ingredient_id IS NOT NULL AND sub_recipe_id IS NULL) OR '
            '(ingredient_id IS NULL AND sub_recipe_id IS NOT NULL)',
            name='check_ingredient_or_subrecipe'
        ),
    )
    
    # Bill of Materials
    op.create_table(
        'bill_of_materials',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('total_cost', sa.Numeric(12, 4)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    
    # BOM Items
    op.create_table(
        'bom_items',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('bom_id', sa.Integer(), sa.ForeignKey('bill_of_materials.id'), nullable=False, index=True),
        sa.Column('recipe_id', sa.Integer(), sa.ForeignKey('recipes.id'), index=True),
        sa.Column('portions', sa.Numeric(10, 4)),
        sa.Column('ingredient_id', sa.Integer(), sa.ForeignKey('ingredients.id'), index=True),
        sa.Column('total_qty', sa.Numeric(10, 4)),
        sa.Column('unit', sa.String(50)),
        sa.Column('unit_cost', sa.Numeric(10, 4)),
        sa.Column('line_cost', sa.Numeric(10, 4)),
    )
    
    # Inventory Counts
    op.create_table(
        'inventory_counts',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('ingredient_id', sa.Integer(), sa.ForeignKey('ingredients.id'), nullable=False, index=True),
        sa.Column('count_date', sa.Date(), nullable=False),
        sa.Column('quantity', sa.Numeric(10, 4), nullable=False),
        sa.Column('unit', sa.String(50), nullable=False),
        sa.Column('notes', sa.Text()),
    )


def downgrade() -> None:
    """Drop all tables."""
    op.drop_table('inventory_counts')
    op.drop_table('bom_items')
    op.drop_table('bill_of_materials')
    op.drop_table('recipe_items')
    op.drop_table('recipes')
    op.drop_table('ingredient_price_history')
    op.drop_table('ingredients')
    op.drop_table('suppliers')
    op.drop_table('recipe_categories')
    op.drop_table('ingredient_categories')
    op.drop_table('users')
