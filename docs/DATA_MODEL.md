# BOM - Data Model

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐
│     users       │       │   suppliers     │
├─────────────────┤       ├─────────────────┤
│ id              │       │ id              │
│ email           │       │ name            │
│ password_hash   │       │ contact_name    │
│ api_key         │       │ phone           │
│ created_at      │       │ email           │
│ updated_at      │       │ address         │
└────────┬────────┘       │ user_id (FK)    │
         │                └────────┬────────┘
         │                         │
         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐
│ ingredient_     │       │   ingredients   │
│ categories      │       ├─────────────────┤
├─────────────────┤       │ id              │
│ id              │◀──────│ category_id(FK) │
│ name            │       │ supplier_id(FK) │
│ user_id (FK)    │       │ name            │
│ sort_order      │       │ description     │
└─────────────────┘       │ purchase_unit   │
                          │ purchase_qty    │
                          │ purchase_price  │
                          │ recipe_unit     │
                          │ conversion_factor│
                          │ yield_percent   │
                          │ allergens (JSON)│
                          │ nutrition (JSON)│
                          │ user_id (FK)    │
                          │ created_at      │
                          │ updated_at      │
                          └────────┬────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
         ▼                         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ recipe_         │       │    recipes      │       │ ingredient_     │
│ categories      │       ├─────────────────┤       │ price_history   │
├─────────────────┤       │ id              │       ├─────────────────┤
│ id              │◀──────│ category_id(FK) │       │ id              │
│ name            │       │ name            │       │ ingredient_id   │
│ user_id (FK)    │       │ description     │       │ price           │
│ sort_order      │       │ yield_qty       │       │ effective_date  │
└─────────────────┘       │ yield_unit      │       │ notes           │
                          │ prep_time_min   │       └─────────────────┘
                          │ cook_time_min   │
                          │ selling_price   │
                          │ target_cost_pct │
                          │ instructions    │
                          │ user_id (FK)    │
                          │ created_at      │
                          │ updated_at      │
                          └────────┬────────┘
                                   │
                                   │
                                   ▼
                          ┌─────────────────┐
                          │ recipe_items    │
                          ├─────────────────┤
                          │ id              │
                          │ recipe_id (FK)  │
                          │ ingredient_id   │
                          │ sub_recipe_id   │
                          │ quantity        │
                          │ unit            │
                          │ sort_order      │
                          │ notes           │
                          └─────────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         │                                                   │
         ▼                                                   ▼
┌─────────────────┐                                 ┌─────────────────┐
│  bill_of_       │                                 │ inventory_      │
│  materials      │                                 │ counts          │
├─────────────────┤                                 ├─────────────────┤
│ id              │                                 │ id              │
│ name            │                                 │ ingredient_id   │
│ date            │                                 │ count_date      │
│ user_id (FK)    │                                 │ quantity        │
│ total_cost      │                                 │ unit            │
│ created_at      │                                 │ user_id (FK)    │
└────────┬────────┘                                 │ notes           │
         │                                          └─────────────────┘
         │
         ▼
┌─────────────────┐
│ bom_items       │
├─────────────────┤
│ id              │
│ bom_id (FK)     │
│ recipe_id (FK)  │
│ portions        │
│ ingredient_id   │
│ total_qty       │
│ unit            │
│ unit_cost       │
│ line_cost       │
└─────────────────┘
```

---

## Table Definitions

### users
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-increment ID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | User email |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt hash |
| api_key | VARCHAR(64) | UNIQUE | For API access |
| settings | JSONB | DEFAULT '{}' | User preferences |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | | |

### ingredient_categories
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | |
| user_id | INTEGER | FOREIGN KEY (users) | Owner |
| name | VARCHAR(100) | NOT NULL | Category name |
| sort_order | INTEGER | DEFAULT 0 | Display order |

### ingredients
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | |
| user_id | INTEGER | FOREIGN KEY (users) | Owner |
| category_id | INTEGER | FOREIGN KEY | Category |
| supplier_id | INTEGER | FOREIGN KEY | Supplier |
| name | VARCHAR(255) | NOT NULL | Ingredient name |
| description | TEXT | | Notes |
| purchase_unit | VARCHAR(50) | NOT NULL | e.g., "case", "lb" |
| purchase_qty | DECIMAL(10,4) | NOT NULL | Qty per purchase unit |
| purchase_price | DECIMAL(10,4) | NOT NULL | Cost per purchase unit |
| recipe_unit | VARCHAR(50) | NOT NULL | e.g., "oz", "cup" |
| conversion_factor | DECIMAL(10,6) | NOT NULL | recipe_unit per purchase_unit |
| yield_percent | DECIMAL(5,2) | DEFAULT 100 | Usable yield |
| allergens | JSONB | DEFAULT '[]' | e.g., ["milk", "eggs"] |
| nutrition | JSONB | DEFAULT '{}' | Per 100g or per unit |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | | |

### recipes
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | |
| user_id | INTEGER | FOREIGN KEY (users) | Owner |
| category_id | INTEGER | FOREIGN KEY | Category |
| name | VARCHAR(255) | NOT NULL | Recipe name |
| description | TEXT | | Notes |
| yield_qty | DECIMAL(10,4) | NOT NULL | Portions/servings |
| yield_unit | VARCHAR(50) | DEFAULT 'portion' | e.g., "portion", "dozen" |
| prep_time_min | INTEGER | | Prep time in minutes |
| cook_time_min | INTEGER | | Cook time in minutes |
| selling_price | DECIMAL(10,4) | | Sale price per yield_unit |
| target_cost_pct | DECIMAL(5,2) | DEFAULT 30 | Target food cost % |
| instructions | TEXT | | Prep instructions |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | | |

### recipe_items
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | |
| recipe_id | INTEGER | FOREIGN KEY (recipes) | Parent recipe |
| ingredient_id | INTEGER | FOREIGN KEY | Ingredient (if not sub-recipe) |
| sub_recipe_id | INTEGER | FOREIGN KEY (recipes) | Sub-recipe (if not ingredient) |
| quantity | DECIMAL(10,4) | NOT NULL | Amount used |
| unit | VARCHAR(50) | NOT NULL | Unit of measure |
| sort_order | INTEGER | DEFAULT 0 | Display order |
| notes | VARCHAR(255) | | Line notes |

CHECK: (ingredient_id IS NOT NULL) OR (sub_recipe_id IS NOT NULL)

### bill_of_materials
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | |
| user_id | INTEGER | FOREIGN KEY (users) | Owner |
| name | VARCHAR(255) | NOT NULL | BOM name |
| date | DATE | NOT NULL | Target date |
| total_cost | DECIMAL(12,4) | | Calculated total |
| created_at | TIMESTAMP | DEFAULT NOW() | |

### bom_items
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | |
| bom_id | INTEGER | FOREIGN KEY | Parent BOM |
| recipe_id | INTEGER | FOREIGN KEY (recipes) | Source recipe |
| portions | DECIMAL(10,4) | NOT NULL | Portions requested |
| ingredient_id | INTEGER | FOREIGN KEY | Resulting ingredient |
| total_qty | DECIMAL(10,4) | | Aggregated quantity |
| unit | VARCHAR(50) | | Unit |
| unit_cost | DECIMAL(10,4) | | Cost per unit |
| line_cost | DECIMAL(10,4) | | total_qty * unit_cost |

---

## Key Relationships

1. **User → Everything**: All data is scoped to a user (multi-tenant)
2. **Recipe → Recipe Items**: One recipe has many items
3. **Recipe Item → Ingredient OR Sub-Recipe**: Each item is either an ingredient or another recipe
4. **Ingredient → Price History**: Track cost changes over time
5. **BOM → BOM Items**: Aggregated ingredients from multiple recipes

---

## Allergen Schema (JSONB)

```json
{
  "contains": ["milk", "eggs", "wheat"],
  "may_contain": ["tree_nuts"]
}
```

**Standard Allergens (FDA Big 9):**
- milk
- eggs
- fish
- shellfish
- tree_nuts
- peanuts
- wheat
- soybeans
- sesame

---

## Nutrition Schema (JSONB)

```json
{
  "serving_size": "100g",
  "calories": 250,
  "total_fat_g": 12,
  "saturated_fat_g": 5,
  "cholesterol_mg": 30,
  "sodium_mg": 400,
  "total_carbs_g": 28,
  "dietary_fiber_g": 2,
  "sugars_g": 8,
  "protein_g": 8
}
```

---

## Indexes

```sql
-- Performance indexes
CREATE INDEX idx_ingredients_user ON ingredients(user_id);
CREATE INDEX idx_ingredients_category ON ingredients(category_id);
CREATE INDEX idx_recipes_user ON recipes(user_id);
CREATE INDEX idx_recipes_category ON recipes(category_id);
CREATE INDEX idx_recipe_items_recipe ON recipe_items(recipe_id);
CREATE INDEX idx_bom_items_bom ON bom_items(bom_id);

-- Full-text search
CREATE INDEX idx_ingredients_name_search ON ingredients USING gin(to_tsvector('english', name));
CREATE INDEX idx_recipes_name_search ON recipes USING gin(to_tsvector('english', name));
```
