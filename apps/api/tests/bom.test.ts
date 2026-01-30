import { beforeAll, afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { PrismaClient, Prisma } from '@prisma/client';
import { app } from '../src/app.js';

const prisma = new PrismaClient();
const TEST_USER_ID = 'test-bom-user';

describe('BOM API', () => {
  let ingredientId: number;
  let recipeId: number;

  beforeAll(async () => {
    // Create test user
    await prisma.user.upsert({
      where: { email: 'bom-test@bom.dev' },
      update: { id: TEST_USER_ID },
      create: {
        id: TEST_USER_ID,
        email: 'bom-test@bom.dev',
        name: 'BOM Test User',
        emailVerified: true
      }
    });

    // Create test ingredient
    const ingredient = await prisma.ingredient.create({
      data: {
        userId: TEST_USER_ID,
        name: 'BOM Test Flour',
        purchaseUnit: 'lb',
        purchaseQty: new Prisma.Decimal(25),
        purchasePrice: new Prisma.Decimal(15),
        recipeUnit: 'cup',
        conversionFactor: new Prisma.Decimal(45),
        yieldPercent: new Prisma.Decimal(100)
      }
    });
    ingredientId = ingredient.id;

    // Create test recipe with ingredient
    const recipe = await prisma.recipe.create({
      data: {
        userId: TEST_USER_ID,
        name: 'BOM Test Recipe',
        yieldQty: new Prisma.Decimal(4),
        yieldUnit: 'servings',
        items: {
          create: [{
            ingredientId: ingredient.id,
            quantity: new Prisma.Decimal(2),
            unit: 'cup'
          }]
        }
      }
    });
    recipeId = recipe.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: TEST_USER_ID } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.billOfMaterials.deleteMany({ where: { userId: TEST_USER_ID } });
  });

  describe('POST /api/v1/bom/generate', () => {
    it('generates a BOM successfully', async () => {
      const res = await request(app)
        .post('/api/v1/bom/generate')
        .set('X-User-Id', TEST_USER_ID)
        .send({
          name: 'Test BOM',
          date: '2025-01-30',
          recipes: [{ recipeId, portions: 8 }]
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Test BOM');
      expect(res.body.date).toBe('2025-01-30');
      expect(res.body.recipes.length).toBe(1);
      expect(res.body.ingredients.length).toBe(1);
      expect(res.body.totalCost).toBeDefined();
    });

    it('scales quantities correctly', async () => {
      const res = await request(app)
        .post('/api/v1/bom/generate')
        .set('X-User-Id', TEST_USER_ID)
        .send({
          name: 'Scaled BOM',
          date: '2025-01-30',
          recipes: [{ recipeId, portions: 8 }] // 8 portions from 4-serving recipe = 2x scale
        });

      expect(res.status).toBe(201);
      // Original: 2 cups for 4 servings
      // Scaled: 4 cups for 8 servings
      expect(res.body.ingredients[0].totalQty).toBe('4');
    });

    it('applies scale factor', async () => {
      const res = await request(app)
        .post('/api/v1/bom/generate')
        .set('X-User-Id', TEST_USER_ID)
        .send({
          name: 'Scale Factor BOM',
          date: '2025-01-30',
          recipes: [{ recipeId, portions: 4 }],
          scaleFactor: 2
        });

      expect(res.status).toBe(201);
      // Original: 2 cups for 4 servings, but scaleFactor 2 means portions become 8
      // So: 4 cups
      expect(res.body.ingredients[0].totalQty).toBe('4');
    });

    it('returns 400 for missing recipe', async () => {
      const res = await request(app)
        .post('/api/v1/bom/generate')
        .set('X-User-Id', TEST_USER_ID)
        .send({
          name: 'Bad BOM',
          date: '2025-01-30',
          recipes: [{ recipeId: 99999, portions: 4 }]
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('not found');
    });

    it('returns 400 for empty recipes', async () => {
      const res = await request(app)
        .post('/api/v1/bom/generate')
        .set('X-User-Id', TEST_USER_ID)
        .send({
          name: 'Empty BOM',
          date: '2025-01-30',
          recipes: []
        });

      expect(res.status).toBe(400);
    });

    it('returns 401 without X-User-Id', async () => {
      const res = await request(app)
        .post('/api/v1/bom/generate')
        .send({
          name: 'No Auth BOM',
          date: '2025-01-30',
          recipes: [{ recipeId, portions: 4 }]
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/bom', () => {
    beforeEach(async () => {
      // Create test BOMs sequentially to ensure different createdAt timestamps
      await prisma.billOfMaterials.create({
        data: { userId: TEST_USER_ID, name: 'BOM A', date: new Date('2025-01-28'), totalCost: new Prisma.Decimal(50) }
      });
      await prisma.billOfMaterials.create({
        data: { userId: TEST_USER_ID, name: 'BOM B', date: new Date('2025-01-29'), totalCost: new Prisma.Decimal(75) }
      });
      await prisma.billOfMaterials.create({
        data: { userId: TEST_USER_ID, name: 'BOM C', date: new Date('2025-01-30'), totalCost: new Prisma.Decimal(100) }
      });
    });

    it('returns paginated list', async () => {
      const res = await request(app)
        .get('/api/v1/bom')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(3);
      expect(res.body.total).toBe(3);
      // Sorted by createdAt desc, so BOM C (last created) should be first
      expect(res.body.items[0].name).toBe('BOM C');
    });

    it('supports pagination', async () => {
      const res = await request(app)
        .get('/api/v1/bom?offset=1&limit=1')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].name).toBe('BOM B'); // second newest
      expect(res.body.total).toBe(3);
    });

    it('includes summary fields', async () => {
      const res = await request(app)
        .get('/api/v1/bom')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      const bom = res.body.items[0];
      expect(bom).toHaveProperty('id');
      expect(bom).toHaveProperty('name');
      expect(bom).toHaveProperty('date');
      expect(bom).toHaveProperty('totalCost');
      expect(bom).toHaveProperty('recipeCount');
      expect(bom).toHaveProperty('ingredientCount');
      expect(bom).toHaveProperty('createdAt');
    });
  });

  describe('GET /api/v1/bom/:id', () => {
    it('returns BOM by ID', async () => {
      // First generate a BOM
      const genRes = await request(app)
        .post('/api/v1/bom/generate')
        .set('X-User-Id', TEST_USER_ID)
        .send({
          name: 'Get Test BOM',
          date: '2025-01-30',
          recipes: [{ recipeId, portions: 4 }]
        });

      const bomId = genRes.body.id;

      const res = await request(app)
        .get(`/api/v1/bom/${bomId}`)
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(bomId);
      expect(res.body.name).toBe('Get Test BOM');
      expect(res.body.recipes).toBeDefined();
      expect(res.body.ingredients).toBeDefined();
      expect(res.body.items).toBeDefined();
    });

    it('returns 404 for non-existent BOM', async () => {
      const res = await request(app)
        .get('/api/v1/bom/99999')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/bom/:id', () => {
    it('deletes BOM successfully', async () => {
      const created = await prisma.billOfMaterials.create({
        data: {
          userId: TEST_USER_ID,
          name: 'Delete Test',
          date: new Date('2025-01-30')
        }
      });

      const res = await request(app)
        .delete(`/api/v1/bom/${created.id}`)
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(204);

      const found = await prisma.billOfMaterials.findUnique({ where: { id: created.id } });
      expect(found).toBeNull();
    });

    it('returns 404 for non-existent BOM', async () => {
      const res = await request(app)
        .delete('/api/v1/bom/99999')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(404);
    });
  });

  describe('BOM with multiple recipes', () => {
    let recipe2Id: number;

    beforeAll(async () => {
      // Create second recipe using same ingredient
      const recipe2 = await prisma.recipe.create({
        data: {
          userId: TEST_USER_ID,
          name: 'BOM Test Recipe 2',
          yieldQty: new Prisma.Decimal(2),
          yieldUnit: 'servings',
          items: {
            create: [{
              ingredientId,
              quantity: new Prisma.Decimal(1),
              unit: 'cup'
            }]
          }
        }
      });
      recipe2Id = recipe2.id;
    });

    it('aggregates ingredients from multiple recipes', async () => {
      const res = await request(app)
        .post('/api/v1/bom/generate')
        .set('X-User-Id', TEST_USER_ID)
        .send({
          name: 'Multi Recipe BOM',
          date: '2025-01-30',
          recipes: [
            { recipeId, portions: 4 },  // 2 cups
            { recipeId: recipe2Id, portions: 2 }  // 1 cup
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.recipes.length).toBe(2);
      // Same ingredient should be aggregated
      expect(res.body.ingredients.length).toBe(1);
      expect(res.body.ingredients[0].totalQty).toBe('3'); // 2 + 1 = 3 cups
    });
  });
});
