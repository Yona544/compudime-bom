# BOM - Bill of Materials

**Recipe & Ingredient Cost Calculator for Food Businesses**

[![Tests](https://img.shields.io/badge/tests-122%20passing-brightgreen)](tests/)
[![Python](https://img.shields.io/badge/python-3.11+-blue)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.128+-green)](https://fastapi.tiangolo.com)

## Overview

BOM helps restaurants, bakeries, supermarket delis, and food businesses:

- 📦 **Track ingredient costs** with yield percentages and unit conversions
- 🍳 **Calculate recipe costs** automatically with sub-recipe support
- 📋 **Generate shopping lists** (Bill of Materials) for production planning
- 📊 **Analyze food costs** and maintain target margins
- ⚠️ **Track allergens** across recipes and menus

## Live Demo

- **API:** https://bom-api.fly.dev
- **Swagger Docs:** https://bom-api.fly.dev/docs
- **Marketing Site:** https://bom-website.fly.dev

## Quick Start

```bash
# Setup
cd C:\scripts\BOM
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# Run
python -m uvicorn api.app:app --reload --port 8001

# Test
pytest tests/ -v
```

Open http://localhost:8001/docs for the interactive API documentation.

## Features

### Ingredient Management
- CRUD operations with cost tracking
- Unit conversions (weight, volume, count)
- Yield/waste percentages
- Allergen and nutrition data

### Recipe Costing
- Automatic cost calculation
- Sub-recipe support (recipes within recipes)
- Recipe scaling
- Food cost percentage tracking

### Bill of Materials
- Generate shopping lists from recipes
- Multi-recipe aggregation
- Scale for production quantities
- Export for ordering

## Project Structure

```
BOM/
├── api/                    # FastAPI application
│   ├── routers/           # API endpoints
│   ├── services/          # Business logic
│   ├── schemas/           # Pydantic models
│   └── app.py             # App factory
├── database/              # SQLAlchemy models
├── tests/                 # Test suite (122 tests)
├── docs/                  # Documentation
│   ├── GETTING_STARTED.md
│   ├── DEPLOYMENT.md
│   ├── REQUIREMENTS.md
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   └── API_SPEC.md
├── website/               # Marketing website
│   ├── index.html
│   ├── Dockerfile
│   └── fly.toml
├── fly.toml              # API deployment config
├── Dockerfile            # API container
└── requirements.txt
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/users` | Create user (get API key) |
| GET | `/api/v1/ingredients` | List ingredients |
| POST | `/api/v1/ingredients` | Create ingredient |
| GET | `/api/v1/recipes` | List recipes |
| POST | `/api/v1/recipes` | Create recipe |
| POST | `/api/v1/recipes/{id}/items` | Add ingredient to recipe |
| GET | `/api/v1/recipes/{id}/cost` | Get recipe cost breakdown |
| POST | `/api/v1/bom/generate` | Generate bill of materials |

See full API documentation at `/docs` or `/redoc`.

## Documentation

- [Getting Started](docs/GETTING_STARTED.md) - Quick start guide
- [Deployment](docs/DEPLOYMENT.md) - Production deployment
- [Requirements](docs/REQUIREMENTS.md) - Feature specifications
- [Architecture](docs/ARCHITECTURE.md) - System design
- [Data Model](docs/DATA_MODEL.md) - Database schema
- [API Spec](docs/API_SPEC.md) - API reference

## Tech Stack

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0, Pydantic 2.x
- **Database:** PostgreSQL (production), SQLite (development)
- **Testing:** pytest (122 tests, 93% coverage)
- **Deployment:** Fly.io, Docker
- **Website:** Static HTML/CSS (nginx)

## Testing

```bash
# Run all tests
pytest tests/ -v

# With coverage
pytest tests/ --cov=api --cov-report=html
```

## Deployment

```bash
# Deploy API
flyctl deploy --app bom-api

# Deploy website
cd website && flyctl deploy --app bom-website
```

See [Deployment Guide](docs/DEPLOYMENT.md) for details.

## Integration with Compudime POS

BOM is designed to integrate with Compudime POS systems:

- Import sales data for demand-based BOM generation
- Sync ingredient prices from purchasing
- Export BOMs as purchase orders
- Real-time food cost tracking against revenue

## License

Proprietary - Compudime / Computer Dimensions

## Support

- Email: support@compudime.com
- Website: https://compudime.com
