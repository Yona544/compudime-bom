# Phase 1 Task: Node.js Project Setup

## Goal
Initialize the Node.js/TypeScript backend alongside the existing Python backend. Do NOT delete or modify the Python code.

## Structure to Create

```
C:\scripts\BOM\
├── apps/
│   └── api/
│       ├── src/
│       │   ├── index.ts          # Entry point (starts server)
│       │   ├── app.ts            # Express app setup with middleware
│       │   ├── routes/
│       │   │   └── index.ts      # Route aggregator
│       │   ├── middleware/
│       │   │   ├── error.ts      # Error handler
│       │   │   └── validation.ts # Zod validation helper
│       │   └── lib/
│       │       └── prisma.ts     # Prisma client singleton
│       ├── tests/
│       │   └── setup.ts          # Jest setup
│       ├── package.json
│       ├── tsconfig.json
│       ├── jest.config.js
│       └── .env.example
├── packages/
│   └── db/
│       ├── prisma/
│       │   └── schema.prisma     # Full schema from NODEJS_REWRITE_PLAN.md
│       ├── package.json
│       └── tsconfig.json
└── package.json                   # Root workspace package.json (pnpm)
```

## Dependencies

### apps/api
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "zod": "^3.22.4",
    "@prisma/client": "^5.8.0",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "@types/node": "^20.10.6",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "tsx": "^4.7.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.11",
    "ts-jest": "^29.1.1",
    "supertest": "^6.3.4",
    "@types/supertest": "^6.0.2",
    "prisma": "^5.8.0"
  }
}
```

### packages/db
```json
{
  "dependencies": {
    "@prisma/client": "^5.8.0"
  },
  "devDependencies": {
    "prisma": "^5.8.0",
    "typescript": "^5.3.3"
  }
}
```

## Files to Create

### 1. Root package.json (pnpm workspace)
```json
{
  "name": "bom-monorepo",
  "private": true,
  "packageManager": "pnpm@8.14.0",
  "scripts": {
    "dev": "pnpm --filter api dev",
    "build": "pnpm --filter api build",
    "test": "pnpm --filter api test",
    "db:generate": "pnpm --filter db generate",
    "db:push": "pnpm --filter db push",
    "db:migrate": "pnpm --filter db migrate"
  }
}
```

### 2. pnpm-workspace.yaml
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### 3. apps/api/src/app.ts
- Create Express app
- Add middleware: cors, helmet, express.json()
- Add health endpoint: GET /health returns { status: 'ok', timestamp }
- Add error handler middleware
- Export app (don't listen here)

### 4. apps/api/src/index.ts
- Import app from ./app
- Load dotenv
- Start server on PORT (default 8001)
- Log startup message

### 5. packages/db/prisma/schema.prisma
- Copy the FULL schema from docs/NODEJS_REWRITE_PLAN.md (the Prisma Schema section)
- Use postgresql provider
- Include all models: User, Session, Account, Verification, Ingredient, Recipe, etc.

### 6. apps/api/.env.example
```
NODE_ENV=development
PORT=8001
DATABASE_URL=postgresql://user:pass@localhost:5432/bom
```

## Verification

After setup, these should work:
```bash
cd C:\scripts\BOM
pnpm install
pnpm db:generate
pnpm dev
# GET http://localhost:8001/health should return 200
```

## Notes
- Use pnpm, not npm or yarn
- TypeScript strict mode
- ESM modules (type: "module" in package.json)
- Don't touch existing Python code in api/, database/, tests/, etc.
