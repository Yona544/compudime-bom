# BOM - API Specification

Base URL: `/api/v1`

## Authentication

All endpoints require API key authentication:
```
x-api-key: your-api-key-here
```

---

## Ingredients

### List Ingredients
```http
GET /api/v1/ingredients
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| category_id | integer | Filter by category |
| search | string | Search by name |
| page | integer | Page number (default: 1) |
| per_page | integer | Items per page (default: 50) |

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "name": "All-Purpose Flour",
      "category": { "id": 1, "name": "Dry Goods" },
      "purchase_unit": "lb",
      "purchase_qty": 25,
      "purchase_price": 12.99,
      "recipe_unit": "cup",
      "conversion_factor": 0.0088,
      "unit_cost": 0.047,
      "yield_percent": 100,
      "allergens": ["wheat"],
      "supplier": { "id": 1, "name": "Restaurant Depot" }
    }
  ],
  "total": 150,
  "page": 1,
  "per_page": 50
}
```

### Get Ingredient
```http
GET /api/v1/ingredients/:id
```

### Create Ingredient
```http
POST /api/v1/ingredients
```

**Request Body:**
```json
{
  "name": "Heavy Cream",
  "category_id": 2,
  "supplier_id": 1,
  "purchase_unit": "qt",
  "purchase_qty": 1,
  "purchase_price": 4.99,
  "recipe_unit": "cup",
  "conversion_factor": 4,
  "yield_percent": 100,
  "allergens": ["milk"]
}
```

### Update Ingredient
```http
PUT /api/v1/ingredients/:id
```

### Delete Ingredient
```http
DELETE /api/v1/ingredients/:id
```

---

## Recipes

### List Recipes
```http
GET /api/v1/recipes
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| category_id | integer | Filter by category |
| search | string | Search by name |
| page | integer | Page number |
| per_page | integer | Items per page |

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "name": "Chocolate Chip Cookies",
      "category": { "id": 1, "name": "Desserts" },
      "yield_qty": 24,
      "yield_unit": "cookies",
      "total_cost": 8.45,
      "cost_per_unit": 0.35,
      "selling_price": 2.50,
      "food_cost_pct": 14.1,
      "prep_time_min": 20,
      "cook_time_min": 12
    }
  ],
  "total": 45,
  "page": 1,
  "per_page": 50
}
```

### Get Recipe (with cost breakdown)
```http
GET /api/v1/recipes/:id
```

**Response:**
```json
{
  "id": 1,
  "name": "Chocolate Chip Cookies",
  "category": { "id": 1, "name": "Desserts" },
  "description": "Classic chocolate chip cookies",
  "yield_qty": 24,
  "yield_unit": "cookies",
  "prep_time_min": 20,
  "cook_time_min": 12,
  "selling_price": 2.50,
  "target_cost_pct": 30,
  "instructions": "1. Cream butter and sugar...",
  "items": [
    {
      "id": 1,
      "type": "ingredient",
      "ingredient": {
        "id": 1,
        "name": "All-Purpose Flour"
      },
      "quantity": 2.25,
      "unit": "cup",
      "cost": 0.42
    },
    {
      "id": 2,
      "type": "ingredient",
      "ingredient": {
        "id": 2,
        "name": "Butter"
      },
      "quantity": 1,
      "unit": "cup",
      "cost": 3.50
    },
    {
      "id": 3,
      "type": "sub_recipe",
      "sub_recipe": {
        "id": 5,
        "name": "Vanilla Extract (Homemade)"
      },
      "quantity": 1,
      "unit": "tsp",
      "cost": 0.25
    }
  ],
  "total_cost": 8.45,
  "cost_per_unit": 0.35,
  "food_cost_pct": 14.1,
  "allergens": ["wheat", "milk", "eggs"],
  "nutrition_per_serving": {
    "calories": 150,
    "total_fat_g": 8,
    "protein_g": 2
  }
}
```

### Get Scaled Recipe
```http
GET /api/v1/recipes/:id/scale?portions=100
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| portions | number | Target portions/yield |
| multiplier | number | Scale multiplier (alternative to portions) |

**Response:** Same as Get Recipe, but with scaled quantities and costs.

### Create Recipe
```http
POST /api/v1/recipes
```

**Request Body:**
```json
{
  "name": "Banana Bread",
  "category_id": 1,
  "yield_qty": 12,
  "yield_unit": "slices",
  "prep_time_min": 15,
  "cook_time_min": 60,
  "selling_price": 3.00,
  "target_cost_pct": 25,
  "instructions": "1. Preheat oven to 350°F...",
  "items": [
    {
      "ingredient_id": 1,
      "quantity": 1.5,
      "unit": "cup"
    },
    {
      "sub_recipe_id": 5,
      "quantity": 0.5,
      "unit": "cup"
    }
  ]
}
```

### Update Recipe
```http
PUT /api/v1/recipes/:id
```

### Delete Recipe
```http
DELETE /api/v1/recipes/:id
```

---

## Bill of Materials (BOM)

### Generate BOM
```http
POST /api/v1/bom/generate
```

**Request Body:**
```json
{
  "name": "Weekend Production",
  "date": "2026-02-01",
  "recipes": [
    { "recipe_id": 1, "portions": 100 },
    { "recipe_id": 2, "portions": 50 },
    { "recipe_id": 3, "portions": 200 }
  ]
}
```

**Response:**
```json
{
  "id": 1,
  "name": "Weekend Production",
  "date": "2026-02-01",
  "recipes_included": [
    { "id": 1, "name": "Chocolate Chip Cookies", "portions": 100 },
    { "id": 2, "name": "Banana Bread", "portions": 50 },
    { "id": 3, "name": "Blueberry Muffins", "portions": 200 }
  ],
  "items": [
    {
      "ingredient_id": 1,
      "ingredient_name": "All-Purpose Flour",
      "category": "Dry Goods",
      "total_qty": 15.5,
      "unit": "cup",
      "purchase_qty": 3.1,
      "purchase_unit": "lb",
      "unit_cost": 0.047,
      "line_cost": 0.73,
      "supplier": "Restaurant Depot"
    },
    {
      "ingredient_id": 2,
      "ingredient_name": "Butter",
      "category": "Dairy",
      "total_qty": 8,
      "unit": "cup",
      "purchase_qty": 4,
      "purchase_unit": "lb",
      "unit_cost": 3.50,
      "line_cost": 28.00,
      "supplier": "US Foods"
    }
  ],
  "total_cost": 156.78,
  "created_at": "2026-01-29T01:00:00Z"
}
```

### List BOMs
```http
GET /api/v1/bom
```

### Get BOM
```http
GET /api/v1/bom/:id
```

### Export BOM
```http
GET /api/v1/bom/:id/export?format=csv
```

**Query Parameters:**
| Parameter | Values | Description |
|-----------|--------|-------------|
| format | csv, pdf, json | Export format |

---

## Inventory

### Create Inventory Count
```http
POST /api/v1/inventory/counts
```

**Request Body:**
```json
{
  "count_date": "2026-01-28",
  "items": [
    { "ingredient_id": 1, "quantity": 50, "unit": "lb" },
    { "ingredient_id": 2, "quantity": 10, "unit": "lb" }
  ]
}
```

### List Inventory Counts
```http
GET /api/v1/inventory/counts
```

### Get Current Inventory
```http
GET /api/v1/inventory/current
```

---

## Categories

### List Ingredient Categories
```http
GET /api/v1/ingredient-categories
```

### List Recipe Categories
```http
GET /api/v1/recipe-categories
```

### Create Category
```http
POST /api/v1/ingredient-categories
POST /api/v1/recipe-categories
```

---

## Users & Settings

### Get Current User
```http
GET /api/v1/users/me
```

### Update Settings
```http
PUT /api/v1/users/me/settings
```

### Regenerate API Key
```http
POST /api/v1/users/me/regenerate-api-key
```

---

## Error Responses

All errors follow this format:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      { "field": "quantity", "message": "Must be greater than 0" }
    ]
  },
  "timestamp": "2026-01-29T01:00:00Z"
}
```

**Error Codes:**
| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Missing or invalid API key |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 422 | Invalid input data |
| CONFLICT | 409 | Duplicate or constraint violation |
| INTERNAL_ERROR | 500 | Server error |

---

## Rate Limits

| Tier | Requests/min | Requests/day |
|------|--------------|--------------|
| Free | 60 | 1,000 |
| Pro | 300 | 10,000 |
| Enterprise | Unlimited | Unlimited |
