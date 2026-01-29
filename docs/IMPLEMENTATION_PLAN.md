# BOM Implementation Plan - TDD Approach

## Stack (Matching Dropbox Project)

| Component | Technology | Notes |
|-----------|------------|-------|
| **API Framework** | FastAPI 0.104+ | Async, auto-generates OpenAPI/Swagger |
| **ORM** | SQLAlchemy 2.0 | Async support, type hints |
| **Migrations** | Alembic 1.12+ | Version-controlled schema changes |
| **Database** | PostgreSQL (prod) / SQLite (dev) | Same pattern as Dropbox |
| **Validation** | Pydantic 2.x | Request/response schemas |
| **Testing** | pytest + pytest-asyncio | TDD approach |
| **Coverage** | coverage 7.x | Minimum 80% target |
| **Admin UI** | sqladmin | Database admin interface |
| **Docs** | Swagger UI + ReDoc | Built into FastAPI |

---

## TDD Workflow (Every Task)

```
1. Write failing test(s)
2. Run test → confirm RED
3. Implement minimal code to pass
4. Run test → confirm GREEN
5. Refactor if needed
6. Run full test suite → confirm no regressions
7. Commit with descriptive message
```

**Gate:** No phase advances until all tests pass + manual review.

---

## Phase 0: Project Setup & CI Foundation
**Goal:** Working test harness before any business logic

### 0.1 - Project Scaffolding
- [ ] Create folder structure:
  ```
  C:\scripts\BOM\
  ├── api/
  │   ├── __init__.py
  │   ├── app.py
  │   ├── config.py
  │   ├── routers/
  │   ├── services/
  │   ├── models/
  │   └── repositories/
  ├── tests/
  │   ├── __init__.py
  │   ├── conftest.py          # Shared fixtures
  │   ├── test_health.py       # First test!
  │   └── factories/           # Test data factories
  ├── requirements.txt
  ├── requirements-dev.txt
  ├── pyproject.toml
  ├── .env.example
  └── pytest.ini
  ```

### 0.2 - Dependencies
- [ ] Create `requirements.txt` (production deps)
- [ ] Create `requirements-dev.txt` (test deps)
- [ ] Virtual environment setup script

### 0.3 - Configuration
- [ ] **TEST FIRST:** `test_config.py` - env vars load correctly
- [ ] `config.py` - Pydantic Settings class
- [ ] `.env.example` with all required vars

### 0.4 - Basic App + Health Check
- [ ] **TEST FIRST:** `test_health.py`
  ```python
  def test_health_endpoint_returns_200(client):
      response = client.get("/health")
      assert response.status_code == 200
      assert response.json()["status"] == "healthy"
  
  def test_root_returns_service_info(client):
      response = client.get("/")
      assert response.status_code == 200
      assert "version" in response.json()
  ```
- [ ] `app.py` - FastAPI app with lifespan manager
- [ ] Health router with `/health` and `/` endpoints
- [ ] Swagger UI accessible at `/docs`
- [ ] ReDoc accessible at `/redoc`

### 0.5 - Test Infrastructure
- [ ] `conftest.py` with fixtures:
  - `test_app` - creates isolated test app
  - `client` - sync TestClient
  - `async_client` - async client for async tests
  - `test_db` - in-memory SQLite for tests
- [ ] `pytest.ini` configuration
- [ ] Coverage configuration (`.coveragerc`)

**✅ Phase 0 Gate:**
- [ ] `pytest` runs and passes
- [ ] `pytest --cov` shows coverage report
- [ ] `/docs` shows Swagger UI
- [ ] `/redoc` shows ReDoc
- [ ] Manual review of project structure

---

## Phase 1: Database Foundation
**Goal:** All models and migrations working, tested

### 1.1 - Database Connection
- [ ] **TEST FIRST:** `test_database.py`
  ```python
  def test_database_connects():
      # Should connect without error
      
  def test_session_commits_and_rolls_back():
      # Transaction behavior
  ```
- [ ] `database/database.py` - engine, session factory, async database
- [ ] `database/__init__.py` - exports

### 1.2 - Core Models
- [ ] **TEST FIRST:** `test_models.py`
  ```python
  def test_user_model_creates():
      user = User(email="test@test.com", ...)
      assert user.email == "test@test.com"
  
  def test_ingredient_requires_user():
      # Foreign key constraint
  
  def test_recipe_item_links_ingredient_or_subrecipe():
      # Mutual exclusivity validation
  ```
- [ ] `models/user.py` - User model
- [ ] `models/ingredient.py` - Ingredient model with all fields
- [ ] `models/recipe.py` - Recipe + RecipeItem models
- [ ] `models/inventory.py` - InventoryCount model
- [ ] `models/bom.py` - BOM + BOMItem models
- [ ] `models/__init__.py` - Base, exports

### 1.3 - Alembic Setup
- [ ] `alembic init` 
- [ ] Configure `alembic.ini` and `env.py`
- [ ] Generate initial migration
- [ ] **TEST:** Migration applies cleanly to fresh DB
- [ ] **TEST:** Migration downgrades cleanly

### 1.4 - Repository Pattern
- [ ] **TEST FIRST:** `test_repositories.py`
  ```python
  def test_ingredient_repo_create(test_db):
      repo = IngredientRepository(test_db)
      ingredient = repo.create(user_id=1, name="Flour", ...)
      assert ingredient.id is not None
  
  def test_ingredient_repo_filters_by_user(test_db):
      # Multi-tenant isolation
  ```
- [ ] `repositories/base.py` - Generic CRUD base
- [ ] `repositories/ingredient_repo.py`
- [ ] `repositories/recipe_repo.py`
- [ ] `repositories/bom_repo.py`

**✅ Phase 1 Gate:**
- [ ] All model tests pass
- [ ] All repository tests pass
- [ ] Migrations run forward/backward
- [ ] `pytest --cov` ≥ 80% on database code
- [ ] Manual review of schema matches DATA_MODEL.md

---

## Phase 2: Unit Conversion & Cost Calculation Services
**Goal:** Core business logic tested in isolation

### 2.1 - Unit Converter Service
- [ ] **TEST FIRST:** `test_unit_converter.py`
  ```python
  def test_convert_kg_to_g():
      assert convert(1, "kg", "g") == 1000
  
  def test_convert_lb_to_oz():
      assert convert(1, "lb", "oz") == 16
  
  def test_convert_cups_to_ml():
      assert abs(convert(1, "cup", "ml") - 236.588) < 0.01
  
  def test_convert_incompatible_units_raises():
      with pytest.raises(UnitConversionError):
          convert(1, "kg", "ml")  # weight to volume without density
  
  def test_convert_weight_to_volume_with_density():
      # flour: ~0.593 g/ml
      assert convert(100, "g", "ml", density=0.593) == approx(168.6)
  ```
- [ ] `services/unit_converter.py`
- [ ] Unit definitions (CONVERSIONS dict)
- [ ] Density-based cross-type conversion

### 2.2 - Cost Calculator Service
- [ ] **TEST FIRST:** `test_cost_calculator.py`
  ```python
  def test_ingredient_unit_cost_simple():
      # $10 for 5 lb = $2/lb
      ingredient = Ingredient(purchase_price=10, purchase_qty=5, purchase_unit="lb")
      assert get_unit_cost(ingredient, "lb") == 2.0
  
  def test_ingredient_unit_cost_with_yield():
      # $10 for 5 lb, 80% yield = $2.50/lb usable
      ingredient = Ingredient(purchase_price=10, purchase_qty=5, purchase_unit="lb", yield_percent=80)
      assert get_unit_cost(ingredient, "lb") == 2.5
  
  def test_ingredient_unit_cost_converted():
      # $10 for 5 lb, want cost per oz
      ingredient = Ingredient(purchase_price=10, purchase_qty=5, purchase_unit="lb")
      assert get_unit_cost(ingredient, "oz") == approx(0.125)
  
  def test_recipe_cost_simple():
      # Recipe with 2 ingredients
      
  def test_recipe_cost_with_subrecipe():
      # Recursive cost calculation
  
  def test_recipe_cost_detects_cycle():
      # A contains B contains A → error
  ```
- [ ] `services/cost_calculator.py`
- [ ] Ingredient cost calculation
- [ ] Recipe cost calculation (recursive)
- [ ] Cycle detection for sub-recipes
- [ ] Cost per portion calculation

**✅ Phase 2 Gate:**
- [ ] All converter tests pass
- [ ] All calculator tests pass
- [ ] Edge cases covered (zero qty, missing data, cycles)
- [ ] `pytest --cov` ≥ 90% on services
- [ ] Manual review of calculation logic

---

## Phase 3: Ingredient API
**Goal:** Full CRUD for ingredients, API-tested

### 3.1 - Pydantic Schemas
- [ ] **TEST FIRST:** `test_schemas.py`
  ```python
  def test_ingredient_create_validates_required():
      with pytest.raises(ValidationError):
          IngredientCreate()  # missing required fields
  
  def test_ingredient_create_accepts_valid():
      data = IngredientCreate(name="Flour", purchase_unit="lb", ...)
      assert data.name == "Flour"
  ```
- [ ] `schemas/ingredient.py` - Create, Update, Response schemas
- [ ] `schemas/common.py` - Pagination, error responses

### 3.2 - Ingredient Service
- [ ] **TEST FIRST:** `test_ingredient_service.py`
  ```python
  async def test_create_ingredient(test_db):
      service = IngredientService(test_db)
      result = await service.create(user_id=1, data=IngredientCreate(...))
      assert result.id is not None
  
  async def test_list_ingredients_paginates(test_db):
      # Create 25 ingredients, request page 2 with limit 10
  
  async def test_update_ingredient_partial(test_db):
      # PATCH behavior
  
  async def test_delete_ingredient_soft_or_hard(test_db):
      # Deletion behavior
  ```
- [ ] `services/ingredient_service.py`

### 3.3 - Ingredient Router
- [ ] **TEST FIRST:** `test_ingredient_routes.py`
  ```python
  def test_create_ingredient_returns_201(client, auth_headers):
      response = client.post("/api/v1/ingredients", json={...}, headers=auth_headers)
      assert response.status_code == 201
      assert "id" in response.json()
  
  def test_create_ingredient_validates_input(client, auth_headers):
      response = client.post("/api/v1/ingredients", json={}, headers=auth_headers)
      assert response.status_code == 422
  
  def test_list_ingredients_returns_paginated(client, auth_headers):
      response = client.get("/api/v1/ingredients?limit=10&offset=0", headers=auth_headers)
      assert response.status_code == 200
      assert "items" in response.json()
      assert "total" in response.json()
  
  def test_get_ingredient_not_found_returns_404(client, auth_headers):
      response = client.get("/api/v1/ingredients/99999", headers=auth_headers)
      assert response.status_code == 404
  
  def test_update_ingredient_returns_200(client, auth_headers):
      # PATCH /api/v1/ingredients/{id}
  
  def test_delete_ingredient_returns_204(client, auth_headers):
      # DELETE /api/v1/ingredients/{id}
  
  def test_ingredient_isolation_by_user(client, user1_headers, user2_headers):
      # User 2 cannot see User 1's ingredients
  ```
- [ ] `routers/ingredients.py` - all CRUD endpoints
- [ ] Wire router into app

### 3.4 - Swagger Documentation
- [ ] Verify `/docs` shows all ingredient endpoints
- [ ] Verify request/response schemas documented
- [ ] Add endpoint descriptions and examples
- [ ] Test "Try it out" functionality manually

**✅ Phase 3 Gate:**
- [ ] All ingredient tests pass
- [ ] Swagger shows complete documentation
- [ ] Multi-tenant isolation verified
- [ ] `pytest --cov` ≥ 80% overall
- [ ] Manual API testing via Swagger UI
- [ ] Code review of router → service → repo flow

---

## Phase 4: Recipe API
**Goal:** Recipe CRUD with sub-recipe support

### 4.1 - Recipe Schemas
- [ ] **TEST FIRST:** `test_recipe_schemas.py`
- [ ] `schemas/recipe.py` - Recipe, RecipeItem schemas
- [ ] Validation: item must have ingredient OR sub_recipe (not both)

### 4.2 - Recipe Service
- [ ] **TEST FIRST:** `test_recipe_service.py`
  ```python
  async def test_create_recipe_with_items(test_db):
      # Create recipe with 3 ingredients
  
  async def test_recipe_cost_calculation(test_db):
      # Verify cost rolls up correctly
  
  async def test_recipe_with_subrecipe(test_db):
      # Create sauce, use in main dish
  
  async def test_scale_recipe(test_db):
      # Scale from 10 portions to 50
  
  async def test_subrecipe_cycle_detection(test_db):
      # A → B → A should fail
  ```
- [ ] `services/recipe_service.py`
- [ ] Scaling logic
- [ ] Sub-recipe resolution

### 4.3 - Recipe Router
- [ ] **TEST FIRST:** `test_recipe_routes.py`
- [ ] `routers/recipes.py`
- [ ] Endpoints: CRUD + `/recipes/{id}/cost` + `/recipes/{id}/scale`

**✅ Phase 4 Gate:**
- [ ] All recipe tests pass
- [ ] Sub-recipes work correctly
- [ ] Cycle detection prevents infinite loops
- [ ] Cost calculations verified manually
- [ ] Swagger documentation complete

---

## Phase 5: BOM Generation API
**Goal:** Generate Bill of Materials from recipes

### 5.1 - BOM Service
- [ ] **TEST FIRST:** `test_bom_service.py`
  ```python
  async def test_generate_bom_single_recipe(test_db):
      # 50 portions of Recipe A
  
  async def test_generate_bom_multiple_recipes(test_db):
      # 50 of Recipe A + 30 of Recipe B
  
  async def test_bom_aggregates_shared_ingredients(test_db):
      # Both recipes use flour → single line item
  
  async def test_bom_calculates_total_cost(test_db):
      # Sum of all ingredient costs
  
  async def test_bom_handles_different_units(test_db):
      # Recipe A uses flour in cups, Recipe B in grams
  ```
- [ ] `services/bom_service.py`
- [ ] Recipe flattening (expand sub-recipes)
- [ ] Ingredient aggregation
- [ ] Unit normalization

### 5.2 - BOM Router
- [ ] **TEST FIRST:** `test_bom_routes.py`
- [ ] `routers/bom.py`
- [ ] `POST /api/v1/bom/generate` - create BOM
- [ ] `GET /api/v1/bom/{id}` - retrieve saved BOM
- [ ] `GET /api/v1/bom` - list BOMs

**✅ Phase 5 Gate:**
- [ ] All BOM tests pass
- [ ] Aggregation verified with complex scenarios
- [ ] Export format matches requirements
- [ ] Manual end-to-end test via Swagger

---

## Phase 6: Authentication & Multi-Tenancy
**Goal:** Secure API with proper isolation

### 6.1 - Auth Schemas & Models
- [ ] **TEST FIRST:** `test_auth.py`
- [ ] API key model and validation
- [ ] User context extraction

### 6.2 - Auth Middleware
- [ ] **TEST FIRST:** `test_auth_middleware.py`
  ```python
  def test_missing_api_key_returns_401(client):
      response = client.get("/api/v1/ingredients")
      assert response.status_code == 401
  
  def test_invalid_api_key_returns_401(client):
      response = client.get("/api/v1/ingredients", headers={"x-api-key": "invalid"})
      assert response.status_code == 401
  
  def test_valid_api_key_allows_request(client):
      response = client.get("/api/v1/ingredients", headers={"x-api-key": VALID_KEY})
      assert response.status_code == 200
  ```
- [ ] `middleware/auth.py`
- [ ] API key validation dependency
- [ ] User context injection

### 6.3 - Tenant Isolation Verification
- [ ] **TEST:** Cross-tenant data access prevented
- [ ] **TEST:** Queries always filter by user_id

**✅ Phase 6 Gate:**
- [ ] Auth tests pass
- [ ] No endpoint accessible without valid key
- [ ] Tenant isolation verified
- [ ] Security review completed

---

## Phase 7: Admin UI & Polish
**Goal:** Production-ready application

### 7.1 - SQLAdmin Integration
- [ ] `admin/setup.py` - Admin views for all models
- [ ] Verify CRUD works through admin UI
- [ ] Restrict admin to authenticated users

### 7.2 - Error Handling
- [ ] **TEST:** All error responses follow standard format
- [ ] Global exception handler
- [ ] Validation error formatting

### 7.3 - Logging & Monitoring
- [ ] Request logging middleware
- [ ] Structured JSON logs
- [ ] Health check includes DB status

### 7.4 - Documentation Polish
- [ ] OpenAPI title, description, version
- [ ] All endpoints have summaries
- [ ] Request/response examples
- [ ] Error response documentation

**✅ Phase 7 Gate:**
- [ ] Admin UI functional
- [ ] Logs are useful and structured
- [ ] Documentation complete and accurate
- [ ] Full test suite passes
- [ ] Coverage ≥ 80%

---

## Phase 8: Deployment
**Goal:** Running on Fly.io

### 8.1 - Docker
- [ ] `Dockerfile` (match Dropbox pattern)
- [ ] `.dockerignore`
- [ ] Local Docker build test

### 8.2 - Fly.io Setup
- [ ] `fly.toml` configuration
- [ ] Secrets configured (DATABASE_URL, SECRET_KEY)
- [ ] Initial deployment
- [ ] Smoke test all endpoints

### 8.3 - CI/CD (Optional)
- [ ] GitHub Actions workflow
- [ ] Run tests on PR
- [ ] Deploy on merge to main

**✅ Phase 8 Gate:**
- [ ] Deployed and accessible
- [ ] All endpoints work in production
- [ ] Swagger UI accessible

---

## Quick Reference: Test Commands

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=api --cov-report=html

# Run specific test file
pytest tests/test_ingredients.py

# Run specific test
pytest tests/test_ingredients.py::test_create_ingredient_returns_201

# Run with verbose output
pytest -v

# Run and stop on first failure
pytest -x

# Run tests matching pattern
pytest -k "ingredient"
```

---

## Review Checklist (Every Phase)

Before marking a phase complete:

- [ ] All tests pass (`pytest`)
- [ ] Coverage meets threshold (`pytest --cov`)
- [ ] No linting errors (`ruff check .`)
- [ ] Swagger docs accurate (`/docs`)
- [ ] Code reviewed for:
  - [ ] Proper error handling
  - [ ] Input validation
  - [ ] Multi-tenant isolation
  - [ ] No hardcoded values
  - [ ] Descriptive names
- [ ] Changes committed with clear message
- [ ] Manual testing performed where noted

---

*Last Updated: 2026-01-28*
