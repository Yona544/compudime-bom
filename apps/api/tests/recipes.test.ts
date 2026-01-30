import { beforeAll, afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { PrismaClient, Prisma } from '@prisma/client';
import { app } from '../src/app.js';

const prisma = new PrismaClient();
const TEST_USER_ID = 'test-recipes-user';

describe('Recipes API', () => {
  let ingredientId: number;
  let categoryId: number;

  beforeAll(async () => {
    // Create test user
    await prisma.user.upsert({
      where: { email: 'recipes-test@bom.dev' },
      update: { id: TEST_USER_ID },
      create: {
        id: TEST_USER_ID,
        email: 'recipes-test@bom.dev',
        name: 'Recipes Test User',
        emailVerified: true
      }
    });

    // Create test ingredient
    const ingredient = await prisma.ingredient.create({
      data: {
        userId: TEST_USER_ID,
        name: 'Test Flour',
        purchaseUnit: 'lb',
        purchaseQty: new Prisma.Decimal(25),
        purchasePrice: new Prisma.Decimal(15),
        recipeUnit: 'cup',
        conversionFactor: new Prisma.Decimal(45),
        yieldPercent: new Prisma.Decimal(100)
      }
    });
    ingredientId = ingredient.id;

    // Create test category
    const category = await prisma.recipeCategory.create({
      data: {
        userId: TEST_USER_ID,
        name: 'Test Category',
        sortOrder: 1
      }
    });
    categoryId = category.id;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: TEST_USER_ID } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.recipe.deleteMany({ where: { userId: TEST_USER_ID } });
  });

  describe('POST /api/v1/recipes', () => {
    it('creates a recipe successfully', async () => {
      const res = await request(app)
        .post('/api/v1/recipes')
        .set('X-User-Id', TEST_USER_ID)
        .send({
          name: 'Test Recipe',
          yieldQty: 4,
          yieldUnit: 'servings',
          prepTime: 15,
          cookTime: 30
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Test Recipe');
      expect(res.body.yieldQty).toBe('4');
      expect(res.body.yieldUnit).toBe('servings');
      expect(res.body.items).toEqual([]);
    });

    it('creates a recipe with items', async () => {
      const res = await request(app)
        .post('/api/v1/recipes')
        .set('X-User-Id', TEST_USER_ID)
        .send({
          name: 'Recipe With Items',
          yieldQty: 2,
          yieldUnit: 'loaves',
          items: [
            {
              ingredientId,
              quantity: 3,
              unit: 'cup'
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].ingredientId).toBe(ingredientId);
      expect(res.body.items[0].quantity).toBe('3');
      expect(res.body.items[0].ingredientName).toBe('Test Flour');
    });

    it('creates a recipe with categories', async () => {
      const res = await request(app)
        .post('/api/v1/recipes')
        .set('X-User-Id', TEST_USER_ID)
        .send({
          name: 'Categorized Recipe',
          yieldQty: 4,
          categoryIds: [categoryId]
        });

      expect(res.status).toBe(201);
      expect(res.body.categories.length).toBe(1);
      expect(res.body.categories[0].name).toBe('Test Category');
    });

    it('returns 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/recipes')
        .set('X-User-Id', TEST_USER_ID)
        .send({ name: 'Missing Yield' });

      expect(res.status).toBe(400);
    });

    it('returns 409 for duplicate name', async () => {
      await request(app)
        .post('/api/v1/recipes')
        .set('X-User-Id', TEST_USER_ID)
        .send({ name: 'Duplicate', yieldQty: 1 });

      const res = await request(app)
        .post('/api/v1/recipes')
        .set('X-User-Id', TEST_USER_ID)
        .send({ name: 'Duplicate', yieldQty: 2 });

      expect(res.status).toBe(409);
    });

    it('returns 401 without X-User-Id', async () => {
      const res = await request(app)
        .post('/api/v1/recipes')
        .send({ name: 'No Auth', yieldQty: 1 });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/recipes', () => {
    beforeEach(async () => {
      await prisma.recipe.createMany({
        data: [
          { userId: TEST_USER_ID, name: 'Apple Pie', yieldQty: new Prisma.Decimal(8), yieldUnit: 'slices' },
          { userId: TEST_USER_ID, name: 'Banana Bread', yieldQty: new Prisma.Decimal(1), yieldUnit: 'loaf' },
          { userId: TEST_USER_ID, name: 'Cherry Tart', yieldQty: new Prisma.Decimal(6), yieldUnit: 'servings' }
        ]
      });
    });

    it('returns paginated list', async () => {
      const res = await request(app)
        .get('/api/v1/recipes')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(3);
      expect(res.body.total).toBe(3);
      expect(res.body.items[0].name).toBe('Apple Pie');
    });

    it('supports pagination', async () => {
      const res = await request(app)
        .get('/api/v1/recipes?offset=1&limit=1')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].name).toBe('Banana Bread');
    });

    it('filters by search', async () => {
      const res = await request(app)
        .get('/api/v1/recipes?search=apple')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].name).toBe('Apple Pie');
    });

    it('filters by category', async () => {
      const recipe = await prisma.recipe.findFirst({
        where: { userId: TEST_USER_ID, name: 'Apple Pie' }
      });
      await prisma.recipeCategoryAssignment.create({
        data: { recipeId: recipe!.id, categoryId }
      });

      const res = await request(app)
        .get(`/api/v1/recipes?categoryId=${categoryId}`)
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      expect(res.body.items[0].name).toBe('Apple Pie');
    });
  });

  describe('GET /api/v1/recipes/:id', () => {
    it('returns recipe by ID', async () => {
      const created = await prisma.recipe.create({
        data: {
          userId: TEST_USER_ID,
          name: 'Get Test',
          yieldQty: new Prisma.Decimal(4),
          yieldUnit: 'portions'
        }
      });

      const res = await request(app)
        .get(`/api/v1/recipes/${created.id}`)
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.id);
      expect(res.body.name).toBe('Get Test');
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app)
        .get('/api/v1/recipes/99999')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/v1/recipes/:id', () => {
    it('updates recipe partially', async () => {
      const created = await prisma.recipe.create({
        data: {
          userId: TEST_USER_ID,
          name: 'Update Test',
          yieldQty: new Prisma.Decimal(4),
          yieldUnit: 'portions'
        }
      });

      const res = await request(app)
        .patch(`/api/v1/recipes/${created.id}`)
        .set('X-User-Id', TEST_USER_ID)
        .send({ prepTime: 20, cookTime: 45 });

      expect(res.status).toBe(200);
      expect(res.body.prepTime).toBe(20);
      expect(res.body.cookTime).toBe(45);
      expect(res.body.name).toBe('Update Test');
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app)
        .patch('/api/v1/recipes/99999')
        .set('X-User-Id', TEST_USER_ID)
        .send({ prepTime: 10 });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/recipes/:id', () => {
    it('deletes recipe successfully', async () => {
      const created = await prisma.recipe.create({
        data: {
          userId: TEST_USER_ID,
          name: 'Delete Test',
          yieldQty: new Prisma.Decimal(1),
          yieldUnit: 'batch'
        }
      });

      const res = await request(app)
        .delete(`/api/v1/recipes/${created.id}`)
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(204);

      const found = await prisma.recipe.findUnique({ where: { id: created.id } });
      expect(found).toBeNull();
    });

    it('returns 404 for non-existent', async () => {
      const res = await request(app)
        .delete('/api/v1/recipes/99999')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(404);
    });

    it('prevents deletion if used as sub-recipe', async () => {
      const subRecipe = await prisma.recipe.create({
        data: {
          userId: TEST_USER_ID,
          name: 'Sub Recipe',
          yieldQty: new Prisma.Decimal(1),
          yieldUnit: 'batch'
        }
      });

      const parentRecipe = await prisma.recipe.create({
        data: {
          userId: TEST_USER_ID,
          name: 'Parent Recipe',
          yieldQty: new Prisma.Decimal(1),
          yieldUnit: 'batch',
          items: {
            create: [{ subRecipeId: subRecipe.id, quantity: new Prisma.Decimal(0.5), unit: 'batch' }]
          }
        }
      });

      const res = await request(app)
        .delete(`/api/v1/recipes/${subRecipe.id}`)
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('sub-recipe');
    });
  });

  describe('POST /api/v1/recipes/:id/items', () => {
    it('adds item to recipe', async () => {
      const recipe = await prisma.recipe.create({
        data: {
          userId: TEST_USER_ID,
          name: 'Item Test',
          yieldQty: new Prisma.Decimal(4),
          yieldUnit: 'servings'
        }
      });

      const res = await request(app)
        .post(`/api/v1/recipes/${recipe.id}/items`)
        .set('X-User-Id', TEST_USER_ID)
        .send({
          ingredientId,
          quantity: 2,
          unit: 'cup'
        });

      expect(res.status).toBe(201);
      expect(res.body.ingredientId).toBe(ingredientId);
      expect(res.body.quantity).toBe('2');
    });

    it('returns 404 for non-existent recipe', async () => {
      const res = await request(app)
        .post('/api/v1/recipes/99999/items')
        .set('X-User-Id', TEST_USER_ID)
        .send({
          ingredientId,
          quantity: 1,
          unit: 'cup'
        });

      expect(res.status).toBe(404);
    });

    it('prevents self-reference', async () => {
      const recipe = await prisma.recipe.create({
        data: {
          userId: TEST_USER_ID,
          name: 'Self Ref Test',
          yieldQty: new Prisma.Decimal(1),
          yieldUnit: 'batch'
        }
      });

      const res = await request(app)
        .post(`/api/v1/recipes/${recipe.id}/items`)
        .set('X-User-Id', TEST_USER_ID)
        .send({
          subRecipeId: recipe.id,
          quantity: 1,
          unit: 'batch'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('itself');
    });
  });

  describe('DELETE /api/v1/recipes/:id/items/:itemId', () => {
    it('removes item from recipe', async () => {
      const recipe = await prisma.recipe.create({
        data: {
          userId: TEST_USER_ID,
          name: 'Remove Item Test',
          yieldQty: new Prisma.Decimal(4),
          yieldUnit: 'servings',
          items: {
            create: [{ ingredientId, quantity: new Prisma.Decimal(2), unit: 'cup' }]
          }
        },
        include: { items: true }
      });

      const itemId = recipe.items[0].id;

      const res = await request(app)
        .delete(`/api/v1/recipes/${recipe.id}/items/${itemId}`)
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(204);

      const item = await prisma.recipeItem.findUnique({ where: { id: itemId } });
      expect(item).toBeNull();
    });

    it('returns 404 for non-existent item', async () => {
      const recipe = await prisma.recipe.create({
        data: {
          userId: TEST_USER_ID,
          name: 'No Item Test',
          yieldQty: new Prisma.Decimal(1),
          yieldUnit: 'batch'
        }
      });

      const res = await request(app)
        .delete(`/api/v1/recipes/${recipe.id}/items/99999`)
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/recipes/:id/scale', () => {
    it('scales recipe', async () => {
      const recipe = await prisma.recipe.create({
        data: {
          userId: TEST_USER_ID,
          name: 'Scale Test',
          yieldQty: new Prisma.Decimal(4),
          yieldUnit: 'servings',
          items: {
            create: [{ ingredientId, quantity: new Prisma.Decimal(2), unit: 'cup' }]
          }
        }
      });

      const res = await request(app)
        .post(`/api/v1/recipes/${recipe.id}/scale`)
        .set('X-User-Id', TEST_USER_ID)
        .send({ portions: 8 });

      expect(res.status).toBe(200);
      expect(res.body.originalYield).toBe('4');
      expect(res.body.targetYield).toBe('8');
      expect(res.body.scaleFactor).toBe('2.0000');
      expect(res.body.items[0].scaledQuantity).toBe('4.000');
    });

    it('returns 404 for non-existent recipe', async () => {
      const res = await request(app)
        .post('/api/v1/recipes/99999/scale')
        .set('X-User-Id', TEST_USER_ID)
        .send({ portions: 10 });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/recipes/:id/cost', () => {
    it('returns cost breakdown', async () => {
      const recipe = await prisma.recipe.create({
        data: {
          userId: TEST_USER_ID,
          name: 'Cost Test',
          yieldQty: new Prisma.Decimal(4),
          yieldUnit: 'servings',
          items: {
            create: [{ ingredientId, quantity: new Prisma.Decimal(2), unit: 'cup' }]
          }
        }
      });

      const res = await request(app)
        .get(`/api/v1/recipes/${recipe.id}/cost`)
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(200);
      expect(res.body.recipeId).toBe(recipe.id);
      expect(res.body.recipeName).toBe('Cost Test');
      expect(res.body.totalCost).toBeDefined();
      expect(res.body.items.length).toBe(1);
    });

    it('returns 404 for non-existent recipe', async () => {
      const res = await request(app)
        .get('/api/v1/recipes/99999/cost')
        .set('X-User-Id', TEST_USER_ID);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/v1/recipes/:id/categories', () => {
    it('updates recipe categories', async () => {
      const recipe = await prisma.recipe.create({
        data: {
          userId: TEST_USER_ID,
          name: 'Category Update Test',
          yieldQty: new Prisma.Decimal(1),
          yieldUnit: 'batch'
        }
      });

      const res = await request(app)
        .put(`/api/v1/recipes/${recipe.id}/categories`)
        .set('X-User-Id', TEST_USER_ID)
        .send({ categoryIds: [categoryId] });

      expect(res.status).toBe(200);
      expect(res.body.categories.length).toBe(1);
      expect(res.body.categories[0].id).toBe(categoryId);
    });

    it('clears categories with empty array', async () => {
      const recipe = await prisma.recipe.create({
        data: {
          userId: TEST_USER_ID,
          name: 'Clear Category Test',
          yieldQty: new Prisma.Decimal(1),
          yieldUnit: 'batch',
          categories: { create: [{ categoryId }] }
        },
        include: { categories: true }
      });

      expect(recipe.categories.length).toBe(1);

      const res = await request(app)
        .put(`/api/v1/recipes/${recipe.id}/categories`)
        .set('X-User-Id', TEST_USER_ID)
        .send({ categoryIds: [] });

      expect(res.status).toBe(200);
      expect(res.body.categories.length).toBe(0);
    });
  });
});

describe('Recipe Categories API', () => {
  const CATEGORY_TEST_USER = 'test-recipe-categories-user';

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { email: 'recipe-cat-test@bom.dev' },
      update: { id: CATEGORY_TEST_USER },
      create: {
        id: CATEGORY_TEST_USER,
        email: 'recipe-cat-test@bom.dev',
        name: 'Recipe Category Test User',
        emailVerified: true
      }
    });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: CATEGORY_TEST_USER } }).catch(() => undefined);
  });

  beforeEach(async () => {
    await prisma.recipeCategory.deleteMany({ where: { userId: CATEGORY_TEST_USER } });
  });

  describe('GET /api/v1/recipe-categories', () => {
    it('returns categories list', async () => {
      await prisma.recipeCategory.createMany({
        data: [
          { userId: CATEGORY_TEST_USER, name: 'Appetizers', sortOrder: 1 },
          { userId: CATEGORY_TEST_USER, name: 'Desserts', sortOrder: 2 },
          { userId: CATEGORY_TEST_USER, name: 'Entrees', sortOrder: 3 }
        ]
      });

      const res = await request(app)
        .get('/api/v1/recipe-categories')
        .set('X-User-Id', CATEGORY_TEST_USER);

      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(3);
      expect(res.body.items[0].name).toBe('Appetizers');
    });
  });

  describe('POST /api/v1/recipe-categories', () => {
    it('creates a category successfully', async () => {
      const res = await request(app)
        .post('/api/v1/recipe-categories')
        .set('X-User-Id', CATEGORY_TEST_USER)
        .send({
          name: 'New Category',
          sortOrder: 5
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('New Category');
      expect(res.body.sortOrder).toBe(5);
    });

    it('returns 409 for duplicate category name', async () => {
      await prisma.recipeCategory.create({
        data: { userId: CATEGORY_TEST_USER, name: 'Duplicate', sortOrder: 1 }
      });

      const res = await request(app)
        .post('/api/v1/recipe-categories')
        .set('X-User-Id', CATEGORY_TEST_USER)
        .send({ name: 'Duplicate' });

      expect(res.status).toBe(409);
    });
  });
});
