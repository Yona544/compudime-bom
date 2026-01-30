# Phase 2 Task: Database & Models

## Goal
Set up PostgreSQL database, run migrations, and create seed data for development/testing.

## Prerequisites
- Phase 1 complete (Prisma schema exists at `packages/db/prisma/schema.prisma`)
- PostgreSQL available (Docker or local)

## Tasks

### 1. Docker Compose for PostgreSQL (Development)
Create `docker-compose.yml` at repo root:
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    container_name: bom-postgres
    environment:
      POSTGRES_USER: bom
      POSTGRES_PASSWORD: bom_dev_password
      POSTGRES_DB: bom
    ports:
      - "5432:5432"
    volumes:
      - bom_postgres_data:/var/lib/postgresql/data

volumes:
  bom_postgres_data:
```

### 2. Update .env files
Create `apps/api/.env` (from .env.example):
```
NODE_ENV=development
PORT=8001
DATABASE_URL=postgresql://bom:bom_dev_password@localhost:5432/bom
```

Create `packages/db/.env`:
```
DATABASE_URL=postgresql://bom:bom_dev_password@localhost:5432/bom
```

### 3. Run Prisma Migration
```bash
cd packages/db
pnpm prisma migrate dev --name init
```

### 4. Create Seed Script
Create `packages/db/prisma/seed.ts`:
- Create a test user
- Create sample ingredient categories (Produce, Meat, Dairy, Pantry, Spices)
- Create sample recipe categories (Appetizers, Main Courses, Desserts, Sauces)
- Create sample storage areas (Walk-in Cooler, Dry Storage, Freezer)
- Create a few sample ingredients
- Create a sample recipe with ingredients

### 5. Update packages/db/package.json
Add seed script configuration:
```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "scripts": {
    "seed": "prisma db seed"
  }
}
```

Add tsx to devDependencies for running seed script.

### 6. Test Database Operations
Create `apps/api/tests/db.test.ts`:
- Test connecting to database
- Test creating/reading/deleting an ingredient
- Test creating/reading/deleting a recipe

## Verification

After setup:
```bash
# Start PostgreSQL
docker-compose up -d

# Run migration
pnpm db:migrate

# Seed database
pnpm --filter db seed

# Run tests
pnpm test
```

## Notes
- Use Decimal.js or similar for precise decimal handling in seed data
- Make seed script idempotent (can run multiple times without duplicates)
- Include realistic sample data for demo purposes
