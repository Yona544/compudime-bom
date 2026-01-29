# BOM - Architecture Overview

## System Components

```
┌──────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                         │
│  ┌────────────────────────┐    ┌────────────────────────────┐    │
│  │      Web Frontend      │    │      External Clients      │    │
│  │    (React + TypeScript)│    │   (POS, Mobile, etc.)      │    │
│  │                        │    │                            │    │
│  │  ┌──────────────────┐  │    │  ┌──────────────────────┐  │    │
│  │  │ Recipe Manager   │  │    │  │   REST API Client    │  │    │
│  │  │ Ingredient Editor│  │    │  │   (Delphi, etc.)     │  │    │
│  │  │ BOM Generator    │  │    │  └──────────────────────┘  │    │
│  │  │ Inventory Counts │  │    │                            │    │
│  │  └──────────────────┘  │    │                            │    │
│  └───────────┬────────────┘    └─────────────┬──────────────┘    │
└──────────────┼───────────────────────────────┼───────────────────┘
               │                               │
               │         HTTPS / JSON          │
               │                               │
               ▼                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                          API LAYER                                │
│                       (FastAPI + Python)                          │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                      API Gateway                            │  │
│  │  - Authentication (API Key / Session)                       │  │
│  │  - Rate Limiting                                            │  │
│  │  - Request Logging                                          │  │
│  │  - CORS Handling                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                │                                  │
│  ┌─────────────┬───────────────┼───────────────┬──────────────┐  │
│  │             │               │               │              │  │
│  ▼             ▼               ▼               ▼              ▼  │
│ ┌─────┐     ┌─────┐       ┌─────┐       ┌─────┐       ┌─────┐   │
│ │Ingr.│     │Recip│       │ BOM │       │Inven│       │Users│   │
│ │Route│     │Route│       │Route│       │Route│       │Route│   │
│ └──┬──┘     └──┬──┘       └──┬──┘       └──┬──┘       └──┬──┘   │
│    │           │             │             │             │       │
└────┼───────────┼─────────────┼─────────────┼─────────────┼───────┘
     │           │             │             │             │
     ▼           ▼             ▼             ▼             ▼
┌──────────────────────────────────────────────────────────────────┐
│                       SERVICE LAYER                               │
│                                                                   │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐ │
│  │  Ingredient   │  │    Recipe     │  │         BOM           │ │
│  │   Service     │  │   Service     │  │       Service         │ │
│  │               │  │               │  │                       │ │
│  │ - CRUD ops    │  │ - CRUD ops    │  │ - Generate from       │ │
│  │ - Cost calc   │  │ - Cost calc   │  │   recipes             │ │
│  │ - Unit conv.  │  │ - Scaling     │  │ - Aggregate items     │ │
│  │ - Price hist. │  │ - Sub-recipes │  │ - Cost totals         │ │
│  └───────┬───────┘  └───────┬───────┘  └───────────┬───────────┘ │
│          │                  │                      │             │
│          └──────────────────┼──────────────────────┘             │
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────────┐ │
│  │                   Shared Services                            │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │ │
│  │  │ Unit        │  │ Allergen    │  │ Nutrition           │  │ │
│  │  │ Converter   │  │ Calculator  │  │ Calculator          │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                              │
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      DATA ACCESS LAYER                            │
│                      (SQLAlchemy ORM)                             │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Repository Pattern                        │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │ │
│  │  │Ingredien│  │ Recipe  │  │   BOM   │  │ InventoryCount  │ │ │
│  │  │   Repo  │  │  Repo   │  │  Repo   │  │      Repo       │ │ │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Database Models                           │ │
│  │  User, Ingredient, Recipe, RecipeItem, BOM, InventoryCount  │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                       DATABASE LAYER                              │
│                        (PostgreSQL)                               │
│                                                                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐│
│  │  users  │ │ingredien│ │ recipes │ │   bom   │ │  inventory  ││
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. Multi-Tenant Data Isolation

All entities include `user_id` for tenant isolation:
```python
class IngredientRepository:
    def get_all(self, user_id: int) -> List[Ingredient]:
        return session.query(Ingredient).filter(
            Ingredient.user_id == user_id
        ).all()
```

### 2. Recipe Cost Calculation

Cost flows bottom-up:
```
Ingredient Cost = (purchase_price / purchase_qty / conversion_factor) / (yield_percent / 100)

Recipe Item Cost = ingredient_cost * quantity

Recipe Total Cost = SUM(recipe_item_costs) + SUM(sub_recipe_costs)

Cost Per Portion = recipe_total_cost / yield_qty
```

### 3. Sub-Recipe Recursion

Recipes can contain other recipes (sub-recipes):
```python
def calculate_recipe_cost(recipe_id: int, scale: float = 1.0) -> Decimal:
    total = Decimal(0)
    
    for item in recipe.items:
        if item.ingredient_id:
            # Direct ingredient
            total += item.quantity * scale * get_ingredient_unit_cost(item.ingredient_id)
        elif item.sub_recipe_id:
            # Recursive sub-recipe
            sub_cost = calculate_recipe_cost(item.sub_recipe_id, item.quantity * scale)
            total += sub_cost
    
    return total
```

**Cycle Detection:** Prevent infinite loops by tracking visited recipes.

### 4. Unit Conversion

Centralized unit converter:
```python
# Base units: grams, milliliters
CONVERSIONS = {
    "weight": {
        "g": 1,
        "kg": 1000,
        "oz": 28.3495,
        "lb": 453.592,
    },
    "volume": {
        "ml": 1,
        "l": 1000,
        "tsp": 4.929,
        "tbsp": 14.787,
        "cup": 236.588,
        "fl_oz": 29.574,
    }
}
```

For weight↔volume, use ingredient-specific density.

### 5. BOM Generation

```python
def generate_bom(recipe_requests: List[RecipeRequest]) -> BOM:
    """
    Input: [{ recipe_id: 1, portions: 50 }, { recipe_id: 2, portions: 30 }]
    Output: Aggregated ingredient list with totals
    """
    ingredients = {}  # ingredient_id -> { total_qty, unit, cost }
    
    for req in recipe_requests:
        scale = req.portions / recipe.yield_qty
        
        for item in flatten_recipe(recipe):
            if item.ingredient_id in ingredients:
                ingredients[item.ingredient_id]["total_qty"] += item.quantity * scale
            else:
                ingredients[item.ingredient_id] = {
                    "total_qty": item.quantity * scale,
                    "unit": item.unit,
                    "unit_cost": get_ingredient_unit_cost(item.ingredient_id)
                }
    
    return BOM(items=ingredients)
```

---

## Folder Structure

```
C:\scripts\BOM\
├── api/
│   ├── __init__.py
│   ├── app.py              # FastAPI app
│   ├── config.py           # Settings
│   ├── dependencies.py     # Dependency injection
│   │
│   ├── routers/
│   │   ├── ingredients.py
│   │   ├── recipes.py
│   │   ├── bom.py
│   │   ├── inventory.py
│   │   └── users.py
│   │
│   ├── services/
│   │   ├── ingredient_service.py
│   │   ├── recipe_service.py
│   │   ├── bom_service.py
│   │   ├── unit_converter.py
│   │   └── cost_calculator.py
│   │
│   ├── models/
│   │   ├── database.py     # SQLAlchemy models
│   │   └── schemas.py      # Pydantic schemas
│   │
│   └── repositories/
│       ├── base.py
│       ├── ingredient_repo.py
│       └── recipe_repo.py
│
├── frontend/               # React app (later)
│   ├── src/
│   └── package.json
│
├── tests/
│   ├── test_ingredients.py
│   ├── test_recipes.py
│   └── test_bom.py
│
├── docs/
│   ├── REQUIREMENTS.md
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── API_SPEC.md
│   └── STACK_DECISION.md
│
├── .env.example
├── requirements.txt
├── Dockerfile
└── README.md
```

---

## Security Considerations

1. **Authentication**: API key in `x-api-key` header
2. **Authorization**: All queries scoped to user_id
3. **Input Validation**: Pydantic models validate all input
4. **SQL Injection**: SQLAlchemy ORM prevents injection
5. **Rate Limiting**: FastAPI middleware for API throttling
6. **HTTPS**: TLS required in production

---

## Performance Considerations

1. **Caching**: Cache expensive cost calculations
2. **Eager Loading**: Use joinedload for recipe items
3. **Pagination**: All list endpoints paginated
4. **Indexes**: Full-text search on names
5. **Connection Pooling**: SQLAlchemy pool for DB connections
