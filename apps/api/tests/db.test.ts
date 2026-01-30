import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

const prisma = new PrismaClient();
const dec = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);

describe('database', () => {
  let userId: string;

  beforeAll(async () => {
    const user = await prisma.user.upsert({
      where: { email: 'test-db@bom.dev' },
      update: { name: 'DB Test User', emailVerified: true },
      create: { email: 'test-db@bom.dev', name: 'DB Test User', emailVerified: true }
    });

    userId = user.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it('connects to the database', async () => {
    const result = await prisma.$queryRaw<{ one: number }[]>`SELECT 1 as one`;
    expect(result[0].one).toBe(1);
  });

  it('creates, reads, and deletes an ingredient', async () => {
    const ingredientName = 'Test Ingredient';

    await prisma.ingredient.deleteMany({
      where: { userId, name: ingredientName }
    });

    const created = await prisma.ingredient.create({
      data: {
        userId,
        name: ingredientName,
        description: 'Ingredient created in db.test.ts',
        purchaseUnit: 'lb',
        purchaseQty: dec('5'),
        purchasePrice: dec('12.50'),
        recipeUnit: 'oz',
        conversionFactor: dec('16'),
        yieldPercent: dec('100'),
        minStockLevel: dec('1.000'),
        currentStock: dec('2.500')
      }
    });

    const fetched = await prisma.ingredient.findUnique({
      where: { id: created.id }
    });

    expect(fetched?.name).toBe(ingredientName);

    await prisma.ingredient.delete({ where: { id: created.id } });

    const deleted = await prisma.ingredient.findUnique({
      where: { id: created.id }
    });

    expect(deleted).toBeNull();
  });

  it('creates, reads, and deletes a recipe', async () => {
    const recipeName = 'Test Recipe';

    await prisma.recipe.deleteMany({
      where: { userId, name: recipeName }
    });

    const created = await prisma.recipe.create({
      data: {
        userId,
        name: recipeName,
        description: 'Recipe created in db.test.ts',
        yieldQty: dec('4'),
        yieldUnit: 'servings',
        prepTime: 10,
        cookTime: 15,
        isActive: true
      }
    });

    const fetched = await prisma.recipe.findUnique({
      where: { id: created.id }
    });

    expect(fetched?.name).toBe(recipeName);

    await prisma.recipe.delete({ where: { id: created.id } });

    const deleted = await prisma.recipe.findUnique({
      where: { id: created.id }
    });

    expect(deleted).toBeNull();
  });
});