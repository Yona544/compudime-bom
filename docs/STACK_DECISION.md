# BOM - Technology Stack Decision

## Executive Summary

**Recommended Stack:**
- **Backend:** Python (FastAPI)
- **Frontend:** React + TypeScript
- **Database:** PostgreSQL
- **Deployment:** Docker → Fly.io

---

## Stack Options Evaluated

### Backend Options

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Python (FastAPI)** | Fast dev, great docs, async, OpenAPI auto-gen | Slower than compiled | ✅ **Recommended** |
| Python (Django) | Batteries included, admin UI | Heavy for API-focused app | ❌ |
| Node.js (Express) | Fast, huge ecosystem | Callback hell, type safety issues | ❌ |
| Node.js (NestJS) | TypeScript, structured | Learning curve | ⚠️ Alternative |
| Delphi (REST server) | Fast, Windows native | Limited ecosystem, harder to deploy | ❌ |
| Go (Gin/Fiber) | Very fast, simple deploy | Verbose, less rapid prototyping | ⚠️ Alternative |

**Decision: FastAPI (Python)**
- Rapid development with Pydantic validation
- Auto-generated OpenAPI/Swagger docs
- Async support for concurrent requests
- Easy testing with pytest
- Strong typing with type hints
- Existing team familiarity (Dropbox project)

---

### Frontend Options

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **React + TS** | Huge ecosystem, TypeScript, component reuse | Build tooling complexity | ✅ **Recommended** |
| Vue.js | Simpler, good docs | Smaller ecosystem | ⚠️ Alternative |
| HTMX + Jinja | Simple, less JS | Limited interactivity | ⚠️ For admin only |
| Vanilla JS | No build step | Maintenance nightmare | ❌ |
| Delphi WebBroker | Native Windows | Hard to modernize | ❌ |

**Decision: React + TypeScript**
- Type safety catches errors early
- Component reuse for recipe/ingredient cards
- Rich ecosystem (form libs, state management)
- Easy to find developers
- Can use Vite for fast builds

---

### Database Options

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **PostgreSQL** | Robust, JSONB, full-text search | Heavier setup | ✅ **Recommended** |
| SQLite | Simple, file-based | Limited concurrency, no scale | ⚠️ Dev only |
| MySQL | Widely used | Less feature-rich than PG | ❌ |
| MongoDB | Flexible schema | Overkill, harder to reason about | ❌ |

**Decision: PostgreSQL**
- JSONB for flexible metadata (nutrition, allergens)
- Full-text search for ingredient/recipe lookup
- Proven at scale
- Great tooling (pgAdmin, psql)
- Fly.io has managed PostgreSQL

---

### Deployment Options

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Fly.io** | Easy, global, cheap | Newer platform | ✅ **Recommended** |
| AWS (ECS/Lambda) | Powerful, scalable | Complex, expensive | ❌ |
| Heroku | Simple | Expensive, sunset concerns | ❌ |
| Self-hosted (VPS) | Full control | Maintenance burden | ⚠️ Later |
| Local Windows | Easy for testing | Can't share | Dev only |

**Decision: Fly.io**
- Already using for Dropbox project
- Simple Docker deployments
- Managed PostgreSQL available
- Auto-scaling, global distribution
- Reasonable pricing

---

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client                               │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   Web Browser   │  │   POS System    │                   │
│  │  (React + TS)   │  │  (Delphi REST)  │                   │
│  └────────┬────────┘  └────────┬────────┘                   │
└───────────┼────────────────────┼────────────────────────────┘
            │                    │
            ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Gateway (Fly.io)                     │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                 FastAPI Application                      ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   ││
│  │  │ Recipes  │ │Ingredients│ │   BOM    │ │Inventory │   ││
│  │  │  Router  │ │  Router   │ │  Router  │ │  Router  │   ││
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   ││
│  │       └────────────┴────────────┴────────────┘          ││
│  │                         │                                ││
│  │              ┌──────────▼──────────┐                    ││
│  │              │   Service Layer     │                    ││
│  │              │  (Business Logic)   │                    ││
│  │              └──────────┬──────────┘                    ││
│  │                         │                                ││
│  │              ┌──────────▼──────────┐                    ││
│  │              │   SQLAlchemy ORM    │                    ││
│  │              └──────────┬──────────┘                    ││
│  └──────────────────────────┼──────────────────────────────┘│
└──────────────────────────────┼──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                PostgreSQL (Fly.io Managed)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ recipes  │ │ingredients│ │  users   │ │inventory │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## Development Tools

| Tool | Purpose |
|------|---------|
| VS Code | Primary IDE |
| Docker Desktop | Local containers |
| pgAdmin / DBeaver | Database management |
| Postman / Thunder Client | API testing |
| pytest | Backend testing |
| Vitest | Frontend testing |
| GitHub Actions | CI/CD |

---

## MVP Timeline Estimate

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 1: Core** | 2-3 weeks | Ingredients, Recipes, Basic Costing |
| **Phase 2: BOM** | 1-2 weeks | Bill of Materials generation |
| **Phase 3: UI** | 2-3 weeks | React frontend |
| **Phase 4: Polish** | 1-2 weeks | Testing, docs, deployment |

**Total: 6-10 weeks to MVP**

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Complex unit conversions | Use established conversion library (pint) |
| Sub-recipe recursion | Implement cycle detection |
| Cost calculation accuracy | Decimal precision, rounding rules |
| Multi-tenant isolation | Proper tenant context, row-level security |

---

## Conclusion

The **FastAPI + React + PostgreSQL** stack provides:
- Rapid development for MVP
- Strong typing and validation
- Familiar tools (matches existing projects)
- Easy deployment to Fly.io
- Room to scale

This stack balances development speed with production reliability.
