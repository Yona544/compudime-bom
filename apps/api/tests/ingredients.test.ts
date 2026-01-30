import { beforeAll, afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { PrismaClient, Prisma } from '@prisma/client';
import { app } from '../src/app.js';

const prisma = new PrismaClient();
const TEST_USER_ID = 'test-ingredients-user';

describe('Ingredients API', () => {
  let categoryId: number;

  beforeAll(async () => {
    // Create test user
    await prisma.user.upsert({
      where: { email: 'ingredients-test@bom.dev' },
      update: { id: TEST_USER_ID },
      create: {
        id: TEST_USER_ID,
        email: 'ingredients-test@bom.dev',
        name: 'Ingredients Test User',
        emailVerified: true
      }
    });

    // Create a test category
    const category = await prisma.ingredientCategory.create({
      data: {
        userId: TEST_USER_ID,
        name: 'Test Category',
        sortOrder: 1
      }
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    // Clean up - delete user cascades to ingredients and categories
    await prisma.user.delete({ where: { id: TEST_USER_ID } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up ingredients before each test
    await prisma.ingredient.deleteMany({ where: { userId: TEST_USER_ID } });
  });

  describe('POST /api/v1/ingredients', () => {
    it('creates an ingredient successfully', async () => {
      const res = await request(app)
        .post('/api/v1/ingredients')
        .set('X-User-Id', TEST_USER_ID)
        .send({
          name: 'Flour',
          purchaseUnit: 'lb',
          purchaseQty: 25,
          purchasePrice: 15.99,
          recipeUnit: 'cup',
          conversionFactor: 45,
          yieldPercent: 100
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Flour');
      expect(res.body.purchaseQty).toBe('25');
      expect(res.body.purchasePrice).toBe('15.99');
      expect(res.body.unitCost).toBeDefined();
      expect(res.body.categories).toEqual([]);
    });

    it('creates an ingredient with categories', async () => {
      const res = await request(app)
        .post('/api/v1/ingredients')
        .set('X-User-Id', TEST_USER_ID)
        .send({
          name: 'Sugar',
          purchaseUnit: 'lb',
          purchaseQty: 10,
          purchasePrice: 8.50,
          recipeUnit: 'cup',
          conversionFactor: 22,
          categoryIds: [categoryId]
        });

      expect(res.status).toBe(201);
      expect(res.body.categories.length).toBe(1);
      expect(res.body.categories[0].name).toBe('Test Category');
    });

    it('returns 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/ingredients')
        .set('X-User-Id', TEST_USER_ID)
        .send({
          name: 'Incomplete'
          // Missing purchaseUnit, purchaseQty, etc.
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });

    it('returns 409 for duplicate name', async () => {
      // Create first ingredient
      await request(app)
        .post('/api/v1/ingredients')
        .set('X-User-Id', TEST_USER_ID)
        .send({
          name: 'Duplicate Test',
          purchaseUnit: 'lb',
          purchaseQty: 1,
          purchasePrice: 5,
          recipeUnit: 'oz',
          conversionFactor: 16
        });

      // Try to create duplicate
      const res = await request(app)
        .post('/api/v1/ingredients')
        .set('X-User-Id', TEST_USER_ID)
        .send({
          name: 'Duplicate Test',
          purchaseUnit: 'kg',
          purchaseQty: 2,
          purchasePrice: 10,
          recipeUnit: 'g',
          conversionFactor: 1000
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });

    it('returns 401 without X-User-Id header', async () => {
      const res = await request(app)
        .post('/api/v1/ingredients')
        .send({
          name: 'No Auth Test',
          purchaseUnit: 'lb',
          purchaseQty: 1,
          purchasePrice: 5,
          recipeUnit: 'oz',
          conversionFactor: 16
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/ingredients', () => {
    beforeEach(async () => {
      // Create test ingredients
      await prisma.ingredient.createMany({
        data: [
          {
            userId: TEST_USER_ID,
            name: 'Apple',
            purchaseUnit: 'lb',
            purchaseQty: new Prisma.Decimal(5),
            purchasePrice: new Prisma.Decimal(10),
            recipeUnit: 'oz',
            conversionFactor: new Prisma.Decimal(16),
            yieldPercent: new Prisma.Decimal(85)
          },
          {
            userId: TEST_USER_ID,
            name: 'Banana',
            purchaseUnit: 'bunch',
            purchaseQty: new Prisma.Decimal(1),
            purchasePrice: new Prisma.Decimal(2.50),
            recipeUnit: 'each',
            conversionFactor: new Prisma.Decimal(6),
            yieldPercent: new Prisma.Decimal(70)
          },
          {
            userId: TEST_USER_ID,
            name: 'Cherry',
            purchaseUnit: 'lb',
            purchaseQty: new Prisma.Decimal(2),
            purchasePrice: new Prisma.Decimal(8),
            recipeUnit: 'oz',
            conversionFactor: new Prisma.Decimal(16),
            yieldPercent: new Prisma.Decimal(90)
          }
        ]
      });
    });

    it('returns paginated list', async () => {
      const res = await request(app)
        .get('/api/v1/ingredients')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(3);
      expect(res.body.total).toBe(3);
      expect(res.body.offset).toBe(0);
      expect(res.body.limit).toBe(20);
    });

    it('supports pagination with offset and limit', async () => {
      const res = await request(app)
        .get('/api/v1/ingredients?offset=1&limit=1')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      expect(res.body.total).toBe(3);
      expect(res.body.offset).toBe(1);
      expect(res.body.limit).toBe(1);
    });

    it('filters by search term', async () => {
      const res = await request(app)
        .get('/api/v1/ingredients?search=app')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].name).toBe('Apple');
    });

    it('filters by category', async () => {
      // Assign category to an ingredient
      const apple = await prisma.ingredient.findFirst({
        where: { userId: TEST_USER_ID, name: 'Apple' }
      });
      await prisma.ingredientCategoryAssignment.create({
        data: { ingredientId: apple!.id, categoryId }
      });

      const res = await request(app)
        .get(`/api/v1/ingredients?categoryId=${categoryId}`)
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].name).toBe('Apple');
    });
  });

  describe('GET /api/v1/ingredients/:id', () => {
    it('returns ingredient by ID', async () => {
      const created = await prisma.ingredient.create({
        data: {
          userId: TEST_USER_ID,
          name: 'Get Test',
          purchaseUnit: 'lb',
          purchaseQty: new Prisma.Decimal(1),
          purchasePrice: new Prisma.Decimal(5),
          recipeUnit: 'oz',
          conversionFactor: new Prisma.Decimal(16),
          yieldPercent: new Prisma.Decimal(100)
        }
      });

      const res = await request(app)
        .get(`/api/v1/ingredients/${created.id}`)
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.id);
      expect(res.body.name).toBe('Get Test');
      expect(res.body.unitCost).toBeDefined();
    });

    it('returns 404 for non-existent ingredient', async () => {
      const res = await request(app)
        .get('/api/v1/ingredients/99999')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });
  });

  describe('PATCH /api/v1/ingredients/:id', () => {
    it('updates ingredient partially', async () => {
      const created = await prisma.ingredient.create({
        data: {
          userId: TEST_USER_ID,
          name: 'Update Test',
          purchaseUnit: 'lb',
          purchaseQty: new Prisma.Decimal(1),
          purchasePrice: new Prisma.Decimal(5),
          recipeUnit: 'oz',
          conversionFactor: new Prisma.Decimal(16),
          yieldPercent: new Prisma.Decimal(100)
        }
      });

      const res = await request(app)
        .patch(`/api/v1/ingredients/${created.id}`)
        .set('X-User-Id', TEST_USER_ID)
        .send({
          purchasePrice: 7.99,
          notes: 'Updated notes'
        });

      expect(res.status).toBe(200);
      expect(res.body.purchasePrice).toBe('7.99');
      expect(res.body.notes).toBe('Updated notes');
      expect(res.body.name).toBe('Update Test'); // unchanged
    });

    it('returns 404 for non-existent ingredient', async () => {
      const res = await request(app)
        .patch('/api/v1/ingredients/99999')
        .set('X-User-Id', TEST_USER_ID)
        .send({ purchasePrice: 10 });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/ingredients/:id', () => {
    it('deletes ingredient successfully', async () => {
      const created = await prisma.ingredient.create({
        data: {
          userId: TEST_USER_ID,
          name: 'Delete Test',
          purchaseUnit: 'lb',
          purchaseQty: new Prisma.Decimal(1),
          purchasePrice: new Prisma.Decimal(5),
          recipeUnit: 'oz',
          conversionFactor: new Prisma.Decimal(16),
          yieldPercent: new Prisma.Decimal(100)
        }
      });

      const res = await request(app)
        .delete(`/api/v1/ingredients/${created.id}`)
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(204);

      // Verify deleted
      const found = await prisma.ingredient.findUnique({ where: { id: created.id } });
      expect(found).toBeNull();
    });

    it('returns 404 for non-existent ingredient', async () => {
      const res = await request(app)
        .delete('/api/v1/ingredients/99999')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/ingredients/low-stock', () => {
    it('returns low-stock ingredients', async () => {
      await prisma.ingredient.createMany({
        data: [
          {
            userId: TEST_USER_ID,
            name: 'Low Stock Item',
            purchaseUnit: 'lb',
            purchaseQty: new Prisma.Decimal(1),
            purchasePrice: new Prisma.Decimal(5),
            recipeUnit: 'oz',
            conversionFactor: new Prisma.Decimal(16),
            yieldPercent: new Prisma.Decimal(100),
            minStockLevel: new Prisma.Decimal(10),
            currentStock: new Prisma.Decimal(2) // Below min
          },
          {
            userId: TEST_USER_ID,
            name: 'OK Stock Item',
            purchaseUnit: 'lb',
            purchaseQty: new Prisma.Decimal(1),
            purchasePrice: new Prisma.Decimal(5),
            recipeUnit: 'oz',
            conversionFactor: new Prisma.Decimal(16),
            yieldPercent: new Prisma.Decimal(100),
            minStockLevel: new Prisma.Decimal(5),
            currentStock: new Prisma.Decimal(10) // Above min
          },
          {
            userId: TEST_USER_ID,
            name: 'No Stock Level Item',
            purchaseUnit: 'lb',
            purchaseQty: new Prisma.Decimal(1),
            purchasePrice: new Prisma.Decimal(5),
            recipeUnit: 'oz',
            conversionFactor: new Prisma.Decimal(16),
            yieldPercent: new Prisma.Decimal(100)
            // No minStockLevel or currentStock
          }
        ]
      });

      const res = await request(app)
        .get('/api/v1/ingredients/low-stock')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].name).toBe('Low Stock Item');
      expect(res.body.total).toBe(1);
    });
  });

  describe('PUT /api/v1/ingredients/:id/categories', () => {
    it('updates ingredient categories', async () => {
      const created = await prisma.ingredient.create({
        data: {
          userId: TEST_USER_ID,
          name: 'Category Test',
          purchaseUnit: 'lb',
          purchaseQty: new Prisma.Decimal(1),
          purchasePrice: new Prisma.Decimal(5),
          recipeUnit: 'oz',
          conversionFactor: new Prisma.Decimal(16),
          yieldPercent: new Prisma.Decimal(100)
        }
      });

      const res = await request(app)
        .put(`/api/v1/ingredients/${created.id}/categories`)
        .set('X-User-Id', TEST_USER_ID)
        .send({ categoryIds: [categoryId] });

      expect(res.status).toBe(200);
      expect(res.body.categories.length).toBe(1);
      expect(res.body.categories[0].id).toBe(categoryId);
    });

    it('clears categories with empty array', async () => {
      const created = await prisma.ingredient.create({
        data: {
          userId: TEST_USER_ID,
          name: 'Clear Category Test',
          purchaseUnit: 'lb',
          purchaseQty: new Prisma.Decimal(1),
          purchasePrice: new Prisma.Decimal(5),
          recipeUnit: 'oz',
          conversionFactor: new Prisma.Decimal(16),
          yieldPercent: new Prisma.Decimal(100),
          categories: {
            create: [{ categoryId }]
          }
        },
        include: { categories: true }
      });

      expect(created.categories.length).toBe(1);

      const res = await request(app)
        .put(`/api/v1/ingredients/${created.id}/categories`)
        .set('X-User-Id', TEST_USER_ID)
        .send({ categoryIds: [] });

      expect(res.status).toBe(200);
      expect(res.body.categories.length).toBe(0);
    });
  });
});

describe('Ingredient Categories API', () => {
  const CATEGORY_TEST_USER = 'test-categories-user';

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { email: 'categories-test@bom.dev' },
      update: { id: CATEGORY_TEST_USER },
      create: {
        id: CATEGORY_TEST_USER,
        email: 'categories-test@bom.dev',
        name: 'Categories Test User',
        emailVerified: true
      }
    });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: CATEGORY_TEST_USER } }).catch(() => undefined);
  });

  beforeEach(async () => {
    await prisma.ingredientCategory.deleteMany({ where: { userId: CATEGORY_TEST_USER } });
  });

  describe('GET /api/v1/ingredient-categories', () => {
    it('returns categories list', async () => {
      await prisma.ingredientCategory.createMany({
        data: [
          { userId: CATEGORY_TEST_USER, name: 'Dairy', sortOrder: 1 },
          { userId: CATEGORY_TEST_USER, name: 'Produce', sortOrder: 2 },
          { userId: CATEGORY_TEST_USER, name: 'Meat', sortOrder: 3 }
        ]
      });

      const res = await request(app)
        .get('/api/v1/ingredient-categories')
        .set('X-User-Id', CATEGORY_TEST_USER);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(3);
      expect(res.body.items[0].name).toBe('Dairy');
      expect(res.body.items[0].sortOrder).toBe(1);
    });
  });

  describe('POST /api/v1/ingredient-categories', () => {
    it('creates a category successfully', async () => {
      const res = await request(app)
        .post('/api/v1/ingredient-categories')
        .set('X-User-Id', CATEGORY_TEST_USER)
        .send({
          name: 'New Category',
          sortOrder: 5
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('New Category');
      expect(res.body.sortOrder).toBe(5);
      expect(res.body.id).toBeDefined();
    });

    it('returns 409 for duplicate category name', async () => {
      await prisma.ingredientCategory.create({
        data: { userId: CATEGORY_TEST_USER, name: 'Duplicate', sortOrder: 1 }
      });

      const res = await request(app)
        .post('/api/v1/ingredient-categories')
        .set('X-User-Id', CATEGORY_TEST_USER)
        .send({ name: 'Duplicate' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already exists');
    });
  });
});
