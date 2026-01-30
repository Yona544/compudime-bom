# BOM Node.js Rewrite Plan

## Overview

Rewrite the BOM (Bill of Materials) backend from Python/FastAPI to Node.js/Express/TypeScript to align with the SMS platform stack and enable Better Auth + Stripe integration.

## Current State

- **Backend:** Python 3.11, FastAPI, SQLAlchemy, SQLite, Alembic
- **Frontend:** React 19, Vite, TailwindCSS 4, TanStack Query (already aligned)
- **Tests:** 172 pytest tests
- **Endpoints:** 40 API endpoints across 7 routers

## Target State

- **Backend:** Node.js 20+, Express, TypeScript, Prisma, PostgreSQL
- **Auth:** Better Auth (email/password, sessions, password reset)
- **Payments:** Stripe (subscriptions, checkout, webhooks, customer portal)
- **Frontend:** Same (React 19, Vite, TailwindCSS 4)
- **Tests:** Jest + Supertest

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
│         Login | Signup | Dashboard | CRUD Pages          │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Express API Server                     │
├─────────────────────────────────────────────────────────┤
│  Better Auth          │  App Routes      │  Stripe       │
│  - /api/auth/*        │  - /api/v1/*     │  - Webhooks   │
│  - Sessions           │  - Ingredients   │  - Checkout   │
│  - Password Reset     │  - Recipes       │  - Portal     │
└───────────┬───────────┴────────┬─────────┴───────┬──────┘
            │                    │                 │
            ▼                    ▼                 ▼
┌───────────────────┐  ┌─────────────────┐  ┌─────────────┐
│   PostgreSQL      │  │     Redis       │  │   Stripe    │
│   (Prisma ORM)    │  │   (Sessions)    │  │   (Billing) │
└───────────────────┘  └─────────────────┘  └─────────────┘
```

## Database Schema

### Prisma Schema (target)

```prisma
// Auth tables (managed by Better Auth)
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  emailVerified Boolean   @default(false)
  name          String?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  // Stripe fields
  stripeCustomerId     String?   @unique
  stripeSubscriptionId String?
  stripePriceId        String?
  stripeCurrentPeriodEnd DateTime?
  
  // Relations
  sessions      Session[]
  accounts      Account[]
  ingredients   Ingredient[]
  recipes       Recipe[]
  suppliers     Supplier[]
  storageAreas  StorageArea[]
  boms          BillOfMaterials[]
  ingredientCategories IngredientCategory[]
  recipeCategories     RecipeCategory[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  accountId         String
  providerId        String
  accessToken       String?
  refreshToken      String?
  accessTokenExpiresAt DateTime?
  refreshTokenExpiresAt DateTime?
  scope             String?
  idToken           String?
  password          String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([providerId, accountId])
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  
  @@unique([identifier, value])
}

// App tables
model IngredientCategory {
  id        Int      @id @default(autoincrement())
  userId    String
  name      String
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  ingredients IngredientCategoryAssignment[]
  
  @@unique([userId, name])
}

model Ingredient {
  id               Int       @id @default(autoincrement())
  userId           String
  name             String
  description      String?
  purchaseUnit     String
  purchaseQty      Decimal   @db.Decimal(10, 3)
  purchasePrice    Decimal   @db.Decimal(10, 2)
  recipeUnit       String
  conversionFactor Decimal   @db.Decimal(10, 4)
  yieldPercent     Decimal   @default(100) @db.Decimal(5, 2)
  minStockLevel    Decimal?  @db.Decimal(10, 3)
  currentStock     Decimal?  @db.Decimal(10, 3)
  supplierId       Int?
  storageAreaId    Int?
  allergens        Json?
  nutrition        Json?
  notes            String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  supplier    Supplier?    @relation(fields: [supplierId], references: [id])
  storageArea StorageArea? @relation(fields: [storageAreaId], references: [id])
  categories  IngredientCategoryAssignment[]
  recipeItems RecipeItem[]
  bomItems    BOMItem[]
  
  @@unique([userId, name])
}

model IngredientCategoryAssignment {
  ingredientId Int
  categoryId   Int
  
  ingredient Ingredient         @relation(fields: [ingredientId], references: [id], onDelete: Cascade)
  category   IngredientCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  
  @@id([ingredientId, categoryId])
}

model RecipeCategory {
  id        Int      @id @default(autoincrement())
  userId    String
  name      String
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  user    User                       @relation(fields: [userId], references: [id], onDelete: Cascade)
  recipes RecipeCategoryAssignment[]
  
  @@unique([userId, name])
}

model Recipe {
  id           Int       @id @default(autoincrement())
  userId       String
  name         String
  description  String?
  yieldQty     Decimal   @db.Decimal(10, 3)
  yieldUnit    String
  prepTime     Int?
  cookTime     Int?
  instructions String?
  notes        String?
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  
  user       User                      @relation(fields: [userId], references: [id], onDelete: Cascade)
  categories RecipeCategoryAssignment[]
  items      RecipeItem[]
  parentItems RecipeItem[]             @relation("SubRecipe")
  bomItems   BOMItem[]
  
  @@unique([userId, name])
}

model RecipeCategoryAssignment {
  recipeId   Int
  categoryId Int
  
  recipe   Recipe         @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  category RecipeCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  
  @@id([recipeId, categoryId])
}

model RecipeItem {
  id           Int      @id @default(autoincrement())
  recipeId     Int
  ingredientId Int?
  subRecipeId  Int?
  quantity     Decimal  @db.Decimal(10, 3)
  unit         String
  sortOrder    Int      @default(0)
  notes        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  recipe     Recipe      @relation(fields: [recipeId], references: [id], onDelete: Cascade)
  ingredient Ingredient? @relation(fields: [ingredientId], references: [id])
  subRecipe  Recipe?     @relation("SubRecipe", fields: [subRecipeId], references: [id])
  
  @@index([recipeId])
}

model Supplier {
  id                   Int      @id @default(autoincrement())
  userId               String
  name                 String
  contactName          String?
  phone                String?
  email                String?
  address              String?
  customerNumber       String?
  salesRepFirstName    String?
  salesRepLastName     String?
  salesRepEmail        String?
  salesRepPhone        String?
  preferredOrderMethod String?
  deliveryDays         Json?
  notes                String?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  ingredients Ingredient[]
  
  @@unique([userId, name])
}

model StorageArea {
  id              Int      @id @default(autoincrement())
  userId          String
  name            String
  location        String?
  temperatureZone String?
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  ingredients Ingredient[]
  
  @@unique([userId, name])
}

model BillOfMaterials {
  id         Int       @id @default(autoincrement())
  userId     String
  name       String
  date       DateTime  @db.Date
  totalCost  Decimal?  @db.Decimal(10, 2)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  
  user  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  items BOMItem[]
}

model BOMItem {
  id           Int      @id @default(autoincrement())
  bomId        Int
  recipeId     Int?
  ingredientId Int?
  portions     Decimal? @db.Decimal(10, 3)
  totalQty     Decimal? @db.Decimal(10, 3)
  unit         String?
  unitCost     Decimal? @db.Decimal(10, 4)
  lineCost     Decimal? @db.Decimal(10, 2)
  createdAt    DateTime @default(now())
  
  bom        BillOfMaterials @relation(fields: [bomId], references: [id], onDelete: Cascade)
  recipe     Recipe?         @relation(fields: [recipeId], references: [id])
  ingredient Ingredient?     @relation(fields: [ingredientId], references: [id])
  
  @@index([bomId])
}
```

## API Endpoints

### Auth Endpoints (Better Auth - automatic)
- POST /api/auth/sign-up/email - Register with email/password
- POST /api/auth/sign-in/email - Login
- POST /api/auth/sign-out - Logout
- POST /api/auth/forgot-password - Request password reset
- POST /api/auth/reset-password - Reset password
- GET /api/auth/session - Get current session

### Stripe Endpoints
- POST /api/stripe/create-checkout - Create Stripe checkout session
- POST /api/stripe/webhook - Stripe webhook handler
- POST /api/stripe/portal - Create customer portal session
- GET /api/stripe/subscription - Get subscription status

### App Endpoints (same as current)

#### Ingredients (7 endpoints)
- POST /api/v1/ingredients - Create ingredient
- GET /api/v1/ingredients - List ingredients
- GET /api/v1/ingredients/low-stock - List low stock
- GET /api/v1/ingredients/:id - Get ingredient
- PATCH /api/v1/ingredients/:id - Update ingredient
- DELETE /api/v1/ingredients/:id - Delete ingredient
- PUT /api/v1/ingredients/:id/categories - Update categories

#### Recipes (10 endpoints)
- POST /api/v1/recipes - Create recipe
- GET /api/v1/recipes - List recipes
- GET /api/v1/recipes/:id - Get recipe
- PATCH /api/v1/recipes/:id - Update recipe
- DELETE /api/v1/recipes/:id - Delete recipe
- POST /api/v1/recipes/:id/items - Add recipe item
- DELETE /api/v1/recipes/:id/items/:itemId - Remove recipe item
- POST /api/v1/recipes/:id/scale - Scale recipe
- GET /api/v1/recipes/:id/cost - Get recipe cost
- PUT /api/v1/recipes/:id/categories - Update categories

#### Suppliers (5 endpoints)
- POST /api/v1/suppliers - Create
- GET /api/v1/suppliers - List
- GET /api/v1/suppliers/:id - Get
- PATCH /api/v1/suppliers/:id - Update
- DELETE /api/v1/suppliers/:id - Delete

#### Storage Areas (5 endpoints)
- POST /api/v1/storage-areas - Create
- GET /api/v1/storage-areas - List
- GET /api/v1/storage-areas/:id - Get
- PATCH /api/v1/storage-areas/:id - Update
- DELETE /api/v1/storage-areas/:id - Delete

#### BOM (4 endpoints)
- POST /api/v1/bom/generate - Generate BOM
- GET /api/v1/bom - List BOMs
- GET /api/v1/bom/:id - Get BOM
- DELETE /api/v1/bom/:id - Delete BOM

#### Health (2 endpoints)
- GET /health - Health check
- GET / - Service info

## Project Structure

```
apps/
  api/
    src/
      index.ts              # Entry point
      app.ts                # Express app setup
      auth.ts               # Better Auth config
      stripe.ts             # Stripe config
      routes/
        index.ts            # Route aggregator
        ingredients.ts
        recipes.ts
        suppliers.ts
        storage-areas.ts
        bom.ts
        stripe.ts
      middleware/
        auth.ts             # Auth middleware
        subscription.ts     # Check active subscription
        error.ts            # Error handler
        validation.ts       # Zod validation
      services/
        ingredient.service.ts
        recipe.service.ts
        supplier.service.ts
        storage-area.service.ts
        bom.service.ts
        cost-calculator.ts
        unit-converter.ts
      lib/
        prisma.ts           # Prisma client
        stripe.ts           # Stripe client
    tests/
      setup.ts
      ingredients.test.ts
      recipes.test.ts
      suppliers.test.ts
      storage-areas.test.ts
      bom.test.ts
      auth.test.ts
      stripe.test.ts
    package.json
    tsconfig.json
packages/
  db/
    prisma/
      schema.prisma
      migrations/
    package.json
```

## Stripe Integration Details

### Pricing
- Single plan: $X/month (flat fee)
- No free trial
- Card required at signup

### Checkout Flow
1. User fills signup form (email, password, name)
2. Frontend calls POST /api/stripe/create-checkout
3. Backend creates Stripe Checkout Session with:
   - mode: 'subscription'
   - customer_email: user's email
   - metadata: { email, name, password_hash }
4. User redirected to Stripe Checkout
5. After payment, Stripe calls webhook
6. Webhook handler:
   - Creates user account (via Better Auth)
   - Links Stripe customer ID to user
   - Redirects to dashboard

### Webhook Events to Handle
- checkout.session.completed - Create user, activate subscription
- customer.subscription.updated - Update subscription status
- customer.subscription.deleted - Deactivate account
- invoice.payment_failed - Notify user, grace period

### Subscription Middleware
Every protected route checks:
1. User is authenticated (Better Auth)
2. User has active subscription (stripeCurrentPeriodEnd > now)

## Migration Strategy

### Data Migration
1. Export existing SQLite data to JSON
2. Transform to match new Prisma schema
3. Import to PostgreSQL via seed script

### Zero Downtime
- Not critical for new app (no production users yet)
- Can do clean cutover

## Testing Strategy

### Unit Tests
- Service functions
- Cost calculator
- Unit converter

### Integration Tests
- Each endpoint with Supertest
- Auth flows
- Stripe webhooks (mock)

### Test Data
- Fixtures for ingredients, recipes, etc.
- Test Stripe webhook payloads

## Environment Variables

```env
# App
NODE_ENV=development
PORT=8001

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/bom

# Better Auth
BETTER_AUTH_SECRET=<32+ char secret>
BETTER_AUTH_URL=http://localhost:8001

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

# Redis (optional, for sessions)
REDIS_URL=redis://localhost:6379
```

## Implementation Phases

### Phase 1: Project Setup
- Initialize Node.js project with TypeScript
- Set up Express with middleware
- Configure Prisma with PostgreSQL
- Set up testing framework (Jest)

### Phase 2: Database & Models
- Create Prisma schema
- Run migrations
- Create seed data script
- Test database operations

### Phase 3: Core Services
- Unit converter service
- Cost calculator service
- Base CRUD service pattern

### Phase 4: API Routes - Part 1
- Health endpoints
- Ingredients CRUD + low-stock + categories
- Tests for ingredients

### Phase 5: API Routes - Part 2
- Suppliers CRUD
- Storage Areas CRUD
- Tests for both

### Phase 6: API Routes - Part 3
- Recipes CRUD + items + scale + cost + categories
- Tests for recipes

### Phase 7: API Routes - Part 4
- BOM generation, list, get, delete
- Tests for BOM

### Phase 8: Better Auth Integration
- Configure Better Auth
- Auth routes (signup, login, logout, password reset)
- Auth middleware
- Session management
- Tests for auth

### Phase 9: Stripe Integration
- Stripe configuration
- Checkout session creation
- Webhook handler
- Customer portal
- Subscription middleware
- Tests for Stripe (mocked)

### Phase 10: Frontend Auth & Billing
- Login/signup pages
- Subscription status display
- Customer portal link
- Protected route handling

### Phase 11: Data Migration
- Export Python SQLite data
- Transform script
- Import to PostgreSQL
- Verify data integrity

### Phase 12: Final Testing & Cleanup
- End-to-end testing
- Performance testing
- Documentation
- Remove Python backend

## Success Criteria

- [ ] All 40 endpoints working
- [ ] All tests passing (target: 170+)
- [ ] Better Auth working (signup, login, logout, password reset)
- [ ] Stripe working (checkout, subscription, webhooks, portal)
- [ ] Subscription-gated access working
- [ ] Frontend integrated with new backend
- [ ] Data migrated from SQLite
- [ ] No regressions from Python version
