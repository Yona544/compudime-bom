# Phase 3 Task: Core Services

## Goal
Port the unit converter and cost calculator services from Python to TypeScript.

## Source Files (Python)
- `C:\scripts\BOM\api\services\unit_converter.py`
- `C:\scripts\BOM\api\services\cost_calculator.py`

## Target Files (TypeScript)
- `apps/api/src/services/unit-converter.ts`
- `apps/api/src/services/cost-calculator.ts`

## Tasks

### 1. Create services directory
```
apps/api/src/services/
├── unit-converter.ts
├── cost-calculator.ts
└── index.ts
```

### 2. Port Unit Converter Service
Read the Python implementation and port to TypeScript:
- Unit types (weight, volume, count, each)
- Conversion factors between units
- Convert function with density support
- Handle edge cases (unknown units, zero quantities)

### 3. Port Cost Calculator Service
Read the Python implementation and port to TypeScript:
- Calculate ingredient cost per recipe unit
- Calculate recipe cost (sum of all ingredients)
- Handle sub-recipes (recursive cost calculation)
- Cycle detection for sub-recipes
- Cost per portion calculation

### 4. Create Tests
Create `apps/api/tests/services.test.ts`:
- Test unit conversions (weight to weight, volume to volume, etc.)
- Test cost calculations
- Test sub-recipe cost calculation
- Test cycle detection

### 5. Use Decimal.js for precision
Install and use decimal.js for monetary calculations:
```bash
pnpm --filter api add decimal.js
pnpm --filter api add -D @types/decimal.js
```

## Verification
```bash
pnpm test
# All service tests should pass
```

## Notes
- Match the Python API signatures where possible
- Use TypeScript strict types
- Export all functions from index.ts
- Use Prisma Decimal type for database values
