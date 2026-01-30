# BOM Node.js Migration Tracker

**Status:** 🚧 In Progress  
**Started:** 2025-01-29  
**Plan:** `docs/NODEJS_REWRITE_PLAN.md`  
**Target:** Node.js/Express/TypeScript + Better Auth + Stripe

---

## Phase 1: Project Setup
**Status:** ✅ Complete

| Gate | Status | Notes |
|------|--------|-------|
| Node.js project initialized with TypeScript | ✅ | pnpm workspace + ESM |
| Express app with middleware configured | ✅ | cors, helmet, json, error handler |
| Prisma configured with PostgreSQL | ✅ | Full schema from plan |
| Jest testing framework set up | ✅ | ts-jest with ESM support |

**Blocked by:** Nothing  
**Artifacts:** `apps/api/`, `packages/db/`, `pnpm-workspace.yaml`

---

## Phase 2: Database & Models
**Status:** ✅ Complete

| Gate | Status | Notes |
|------|--------|-------|
| Prisma schema complete | ✅ | 17 models |
| Migrations run successfully | ✅ | prisma db push |
| Seed data script working | ✅ | Demo user, categories, ingredients, recipe |
| Database operations tested | ✅ | 3 tests passing |

**Blocked by:** Phase 1  
**Artifacts:** `packages/db/prisma/schema.prisma`, `packages/db/prisma/seed.ts`, `docker-compose.yml`

---

## Phase 3: Core Services
**Status:** ✅ Complete

| Gate | Status | Notes |
|------|--------|-------|
| Unit converter service ported | ✅ | Weight, volume, count with density support |
| Cost calculator service ported | ✅ | Ingredient, recipe, sub-recipe costs |
| Base CRUD service pattern established | ✅ | Via index.ts exports |

**Blocked by:** Phase 2  
**Artifacts:** `src/services/unit-converter.ts`, `src/services/cost-calculator.ts`, `src/services/index.ts`

---

## Phase 4: API Routes - Ingredients
**Status:** ✅ Complete

| Gate | Status | Notes |
|------|--------|-------|
| Ingredients CRUD endpoints | ✅ | POST/GET/GET:id/PATCH/DELETE |
| Low-stock endpoint | ✅ | GET /ingredients/low-stock |
| Categories endpoint | ✅ | GET/POST /ingredient-categories |
| Tests passing | ✅ | 21 new tests (43 total) |

**Blocked by:** Phase 3  
**Artifacts:** `src/routes/ingredients.ts`, `src/routes/ingredient-categories.ts`, `src/schemas/ingredient.ts`, `tests/ingredients.test.ts`

---

## Phase 5: API Routes - Suppliers & Storage
**Status:** ✅ Complete

| Gate | Status | Notes |
|------|--------|-------|
| Suppliers CRUD endpoints | ✅ | POST/GET/GET:id/PATCH/DELETE |
| Storage Areas CRUD endpoints | ✅ | POST/GET/GET:id/PATCH/DELETE |
| Tests passing | ✅ | 29 new tests (72 total) |

**Blocked by:** Phase 3  
**Artifacts:** `src/routes/suppliers.ts`, `src/routes/storage-areas.ts`, `src/schemas/supplier.ts`, `src/schemas/storage-area.ts`

---

## Phase 6: API Routes - Recipes
**Status:** ✅ Complete

| Gate | Status | Notes |
|------|--------|-------|
| Recipes CRUD endpoints | ✅ | POST/GET/GET:id/PATCH/DELETE |
| Recipe items endpoints | ✅ | POST items, DELETE items/:itemId |
| Scale + cost endpoints | ✅ | POST scale, GET cost |
| Categories endpoint | ✅ | GET/POST /recipe-categories |
| Tests passing | ✅ | 31 new tests (103 total) |

**Blocked by:** Phase 4  
**Artifacts:** `src/routes/recipes.ts`, `src/routes/recipe-categories.ts`, `src/schemas/recipe.ts`

---

## Phase 7: API Routes - BOM
**Status:** ✅ Complete

| Gate | Status | Notes |
|------|--------|-------|
| BOM generation endpoint | ✅ | POST /bom/generate with scaling |
| List/Get/Delete endpoints | ✅ | GET list, GET :id, DELETE :id |
| Tests passing | ✅ | 14 new tests (117 total) |

**Blocked by:** Phase 6  
**Artifacts:** `src/routes/bom.ts`, `src/schemas/bom.ts`

---

## Phase 8: Better Auth Integration
**Status:** ✅ Complete

| Gate | Status | Notes |
|------|--------|-------|
| Better Auth configured | ✅ | Prisma adapter, session config |
| Signup/Login/Logout working | ✅ | /api/auth/sign-up/email, sign-in/email |
| Password reset flow working | ✅ | Configured (email sending TODO) |
| Session management working | ✅ | Cookie-based sessions, 7-day expiry |
| Auth middleware protecting routes | ✅ | X-User-Id header support for dev |
| Tests passing | ✅ | 9 auth tests (126 total) |

**Blocked by:** Phase 4  
**Artifacts:** `src/auth.ts`, `src/middleware/auth.ts`, `tests/auth.test.ts`

---

## Phase 9: Stripe Integration
**Status:** 🟡 Next Up

| Gate | Status | Notes |
|------|--------|-------|
| Stripe configured | ⬜ | |
| Checkout session creation | ⬜ | |
| Webhook handler (all events) | ⬜ | |
| Customer portal working | ⬜ | |
| Subscription middleware | ⬜ | |
| Tests passing (mocked) | ⬜ | |

**Blocked by:** Phase 8  
**Artifacts:** `src/stripe.ts`, `src/routes/stripe.ts`

---

## Phase 10: Frontend Auth & Billing
**Status:** ⬜ Not Started

| Gate | Status | Notes |
|------|--------|-------|
| Login/Signup pages updated | ⬜ | |
| Subscription status display | ⬜ | |
| Customer portal link | ⬜ | |
| Protected route handling | ⬜ | |

**Blocked by:** Phase 9  
**Artifacts:** `frontend/src/pages/Login.tsx`, etc.

---

## Phase 11: Data Migration
**Status:** ⬜ Not Started

| Gate | Status | Notes |
|------|--------|-------|
| SQLite data exported to JSON | ⬜ | |
| Transform script working | ⬜ | |
| Data imported to PostgreSQL | ⬜ | |
| Data integrity verified | ⬜ | |

**Blocked by:** Phase 7  
**Artifacts:** Migration scripts

---

## Phase 12: Final Testing & Cleanup
**Status:** ⬜ Not Started

| Gate | Status | Notes |
|------|--------|-------|
| All 170+ tests passing | ⬜ | |
| E2E tests green | ⬜ | |
| Performance acceptable | ⬜ | |
| Documentation updated | ⬜ | |
| Python backend removed | ⬜ | |

**Blocked by:** Phases 1-11  
**Artifacts:** Test reports, docs

---

## Progress Log

| Date | Phase | Update |
|------|-------|--------|
| 2025-01-29 | - | Migration tracker created |
| 2025-01-29 | - | Node.js rewrite plan already exists |
| 2026-01-29 | 1 | ✅ Phase 1 complete - project scaffolding, Express app, Prisma schema |
| 2026-01-29 | 2 | ✅ Phase 2 complete - PostgreSQL, migrations, seed data, 3 tests passing |
| 2026-01-29 | 3 | ✅ Phase 3 complete - unit converter, cost calculator, 22 tests passing |
| 2026-01-30 | 4 | ✅ Phase 4 complete - ingredients API, categories, 43 tests passing |
| 2026-01-30 | 5 | ✅ Phase 5 complete - suppliers + storage areas, 72 tests passing |
| 2026-01-30 | 6 | ✅ Phase 6 complete - recipes + items + scale + cost, 103 tests passing |
| 2026-01-30 | 7 | ✅ Phase 7 complete - BOM generation + CRUD, 117 tests passing |
| 2026-01-30 | 8 | ✅ Phase 8 complete - Better Auth integration, 126 tests passing |

---

## Success Criteria

- [ ] All 40 endpoints working
- [ ] All tests passing (target: 170+)
- [ ] Better Auth working (signup, login, logout, password reset)
- [ ] Stripe working (checkout, subscription, webhooks, portal)
- [ ] Subscription-gated access working
- [ ] Frontend integrated with new backend
- [ ] Data migrated from SQLite
- [ ] No regressions from Python version

---

## Quick Reference

- **Plan:** `docs/NODEJS_REWRITE_PLAN.md`
- **Current Python API:** https://bom-api.fly.dev
- **GitHub:** https://github.com/Yona544/compudime-bom
- **Better Auth:** https://www.better-auth.com/docs
- **Stripe Docs:** https://stripe.com/docs

## Legend

- ⬜ Not started
- 🟡 In progress
- ✅ Complete
- ❌ Blocked
