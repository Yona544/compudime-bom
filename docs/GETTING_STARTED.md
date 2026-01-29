# BOM - Getting Started Guide

## Quick Start

### 1. Local Development

```bash
# Clone and setup
cd C:\scripts\BOM
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# Run the API
python -m uvicorn api.app:app --reload --port 8001

# Open Swagger UI
# http://localhost:8001/docs
```

### 2. Create Your First User

```bash
curl -X POST "http://localhost:8001/api/v1/users" \
  -H "Content-Type: application/json" \
  -d '{"email": "your@email.com"}'
```

Save the `api_key` from the response - you'll need it for all other requests.

### 3. Add Ingredients

```bash
curl -X POST "http://localhost:8001/api/v1/ingredients" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Chicken Breast",
    "purchase_unit": "lb",
    "purchase_qty": 1,
    "purchase_price": 4.99,
    "recipe_unit": "lb",
    "conversion_factor": 1,
    "yield_percent": 85
  }'
```

### 4. Create a Recipe

```bash
curl -X POST "http://localhost:8001/api/v1/recipes" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lemon Garlic Chicken",
    "yield_qty": 4,
    "yield_unit": "portion",
    "selling_price": 12.99
  }'
```

### 5. Add Ingredients to Recipe

```bash
curl -X POST "http://localhost:8001/api/v1/recipes/1/items" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ingredient_id": 1, "quantity": 2, "unit": "lb"}'
```

### 6. Generate a Bill of Materials

```bash
curl -X POST "http://localhost:8001/api/v1/bom/generate" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Monday Prep",
    "date": "2026-01-29",
    "recipes": [{"recipe_id": 1, "portions": 50}]
  }'
```

## Running Tests

```bash
pytest tests/ -v
```

## Deployment

### Deploy API to Fly.io

```bash
flyctl deploy --app bom-api
```

### Deploy Website to Fly.io

```bash
cd website
flyctl deploy --app bom-website
```

## Live URLs

- **API:** https://bom-api.fly.dev
- **API Docs:** https://bom-api.fly.dev/docs
- **Marketing Website:** https://bom-website.fly.dev
