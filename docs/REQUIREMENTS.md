# BOM - Requirements Specification

## 1. Core Features

### 1.1 Ingredient Management
| Feature | Priority | Description |
|---------|----------|-------------|
| Create/Edit Ingredients | P0 | Add ingredients with name, unit cost, purchase unit |
| Ingredient Categories | P0 | Organize ingredients (Produce, Dairy, Meat, etc.) |
| Unit Conversions | P0 | Convert between weight/volume (e.g., cups to grams) |
| Cost History | P1 | Track price changes over time |
| Supplier Assignment | P1 | Link ingredients to suppliers |
| Allergen Tagging | P1 | Tag FDA major allergens (8 allergens) |
| Nutrition Data | P2 | Per-ingredient nutritional information |
| Yield/Waste Factor | P1 | Account for prep waste (e.g., 80% yield on chicken) |

### 1.2 Recipe Management
| Feature | Priority | Description |
|---------|----------|-------------|
| Create/Edit Recipes | P0 | Recipes with ingredients and quantities |
| Recipe Costing | P0 | Auto-calculate total cost from ingredients |
| Recipe Scaling | P0 | Scale recipes by portion count or multiplier |
| Sub-Recipes | P0 | Recipes within recipes (e.g., sauce in main dish) |
| Recipe Categories | P0 | Organize recipes (Appetizers, Entrees, etc.) |
| Prep Instructions | P1 | Step-by-step prep/cooking instructions |
| Instruction Images | P2 | Photos for each prep step |
| Selling Price & Margin | P0 | Set price, calculate food cost % |
| Recipe Versioning | P2 | Track recipe changes over time |
| PDF Export | P1 | Export recipe cards for kitchen |

### 1.3 Bill of Materials (BOM)
| Feature | Priority | Description |
|---------|----------|-------------|
| Generate BOM | P0 | Shopping list from scaled recipes |
| Multi-Recipe BOM | P0 | Combine multiple recipes into one list |
| Production Planning | P1 | Plan production for a day/week |
| BOM from Sales | P2 | Generate BOM from POS sales data |
| Purchase Order Export | P1 | Export BOM as purchase order |

### 1.4 Inventory
| Feature | Priority | Description |
|---------|----------|-------------|
| Inventory Counts | P1 | Record on-hand quantities |
| Inventory Valuation | P1 | Total value of inventory |
| Low Stock Alerts | P2 | Notify when items run low |
| Inventory Depletion | P2 | Auto-reduce based on production |

### 1.5 Reporting
| Feature | Priority | Description |
|---------|----------|-------------|
| Recipe Cost Report | P0 | Cost breakdown per recipe |
| Ingredient Usage | P1 | Which recipes use an ingredient |
| Food Cost Analysis | P1 | Food cost % across menu |
| Allergen Report | P1 | List allergens per menu item |
| Price Change Impact | P2 | How price changes affect recipes |

---

## 2. User Management

| Feature | Priority | Description |
|---------|----------|-------------|
| User Registration | P0 | Email/password signup |
| User Login | P0 | Session-based authentication |
| API Key Generation | P0 | For external integrations |
| Multi-User Accounts | P1 | Team access to same data |
| Role-Based Access | P2 | Admin, Manager, Staff roles |

---

## 3. API Requirements

### 3.1 Must-Have Endpoints
- `GET /api/v1/ingredients` - List ingredients
- `GET /api/v1/ingredients/:id` - Get ingredient
- `POST /api/v1/ingredients` - Create ingredient
- `PUT /api/v1/ingredients/:id` - Update ingredient
- `DELETE /api/v1/ingredients/:id` - Delete ingredient

- `GET /api/v1/recipes` - List recipes
- `GET /api/v1/recipes/:id` - Get recipe with cost breakdown
- `POST /api/v1/recipes` - Create recipe
- `PUT /api/v1/recipes/:id` - Update recipe
- `DELETE /api/v1/recipes/:id` - Delete recipe
- `GET /api/v1/recipes/:id/scale?portions=X` - Get scaled recipe

- `POST /api/v1/bom/generate` - Generate BOM from recipes
- `GET /api/v1/bom/:id` - Get saved BOM

### 3.2 Authentication
- API Key via `x-api-key` header (matching RCC)
- Session-based for web UI

---

## 4. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Response Time | < 500ms for 95th percentile |
| Concurrent Users | Support 100+ simultaneous users |
| Data Retention | Recipes/ingredients kept indefinitely |
| Backup | Daily encrypted backups |
| Mobile Support | Responsive web design |
| Browser Support | Chrome, Firefox, Safari, Edge (latest 2 versions) |

---

## 5. Integration Points

| Integration | Priority | Description |
|-------------|----------|-------------|
| POS System | P1 | Import sales data for BOM planning |
| Supplier Catalogs | P2 | Import/sync ingredient prices |
| Accounting (QB) | P2 | Sync purchases to QuickBooks |
| Nutrition API | P2 | Auto-fetch USDA nutrition data |

---

## 6. Priority Legend

- **P0**: Must have for MVP
- **P1**: Important, include in v1.0
- **P2**: Nice to have, future roadmap
