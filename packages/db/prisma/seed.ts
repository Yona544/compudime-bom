import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const dec = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);

const demoEmail = 'demo@bom.dev';

const ingredientCategorySeed = [
  { name: 'Produce', sortOrder: 0 },
  { name: 'Meat', sortOrder: 1 },
  { name: 'Dairy', sortOrder: 2 },
  { name: 'Pantry', sortOrder: 3 },
  { name: 'Spices', sortOrder: 4 }
];

const recipeCategorySeed = [
  { name: 'Appetizers', sortOrder: 0 },
  { name: 'Main Courses', sortOrder: 1 },
  { name: 'Desserts', sortOrder: 2 },
  { name: 'Sauces', sortOrder: 3 }
];

const storageAreaSeed = [
  { name: 'Walk-in Cooler', location: 'Kitchen', temperatureZone: 'Refrigerated' },
  { name: 'Dry Storage', location: 'Back Hall', temperatureZone: 'Ambient' },
  { name: 'Freezer', location: 'Prep Area', temperatureZone: 'Frozen' }
];

const ingredientSeed = [
  {
    name: 'Roma Tomatoes',
    description: 'Fresh roma tomatoes for soups and sauces.',
    purchaseUnit: 'lb',
    purchaseQty: dec('10'),
    purchasePrice: dec('18.50'),
    recipeUnit: 'oz',
    conversionFactor: dec('16'),
    yieldPercent: dec('92'),
    minStockLevel: dec('2.000'),
    currentStock: dec('5.250'),
    storageArea: 'Walk-in Cooler',
    category: 'Produce'
  },
  {
    name: 'Chicken Breast',
    description: 'Boneless, skinless chicken breast.',
    purchaseUnit: 'lb',
    purchaseQty: dec('20'),
    purchasePrice: dec('64.00'),
    recipeUnit: 'oz',
    conversionFactor: dec('16'),
    yieldPercent: dec('88'),
    minStockLevel: dec('3.000'),
    currentStock: dec('10.000'),
    storageArea: 'Freezer',
    category: 'Meat'
  },
  {
    name: 'Whole Milk',
    description: 'Creamy whole milk for soups and sauces.',
    purchaseUnit: 'gal',
    purchaseQty: dec('4'),
    purchasePrice: dec('14.00'),
    recipeUnit: 'oz',
    conversionFactor: dec('128'),
    yieldPercent: dec('100'),
    minStockLevel: dec('1.000'),
    currentStock: dec('2.000'),
    storageArea: 'Walk-in Cooler',
    category: 'Dairy'
  },
  {
    name: 'Olive Oil',
    description: 'Extra-virgin olive oil.',
    purchaseUnit: 'l',
    purchaseQty: dec('3'),
    purchasePrice: dec('24.00'),
    recipeUnit: 'ml',
    conversionFactor: dec('1000'),
    yieldPercent: dec('100'),
    minStockLevel: dec('0.500'),
    currentStock: dec('1.250'),
    storageArea: 'Dry Storage',
    category: 'Pantry'
  },
  {
    name: 'Paprika',
    description: 'Smoked paprika for depth of flavor.',
    purchaseUnit: 'lb',
    purchaseQty: dec('1'),
    purchasePrice: dec('9.50'),
    recipeUnit: 'g',
    conversionFactor: dec('453.592'),
    yieldPercent: dec('100'),
    minStockLevel: dec('0.100'),
    currentStock: dec('0.400'),
    storageArea: 'Dry Storage',
    category: 'Spices'
  }
];

async function main() {
  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    update: { name: 'Demo User', emailVerified: true },
    create: { email: demoEmail, name: 'Demo User', emailVerified: true }
  });

  const ingredientCategories = await Promise.all(
    ingredientCategorySeed.map((category) =>
      prisma.ingredientCategory.upsert({
        where: { userId_name: { userId: user.id, name: category.name } },
        update: { sortOrder: category.sortOrder },
        create: {
          userId: user.id,
          name: category.name,
          sortOrder: category.sortOrder
        }
      })
    )
  );

  const recipeCategories = await Promise.all(
    recipeCategorySeed.map((category) =>
      prisma.recipeCategory.upsert({
        where: { userId_name: { userId: user.id, name: category.name } },
        update: { sortOrder: category.sortOrder },
        create: {
          userId: user.id,
          name: category.name,
          sortOrder: category.sortOrder
        }
      })
    )
  );

  const storageAreas = await Promise.all(
    storageAreaSeed.map((area) =>
      prisma.storageArea.upsert({
        where: { userId_name: { userId: user.id, name: area.name } },
        update: {
          location: area.location,
          temperatureZone: area.temperatureZone
        },
        create: {
          userId: user.id,
          name: area.name,
          location: area.location,
          temperatureZone: area.temperatureZone
        }
      })
    )
  );

  const ingredientCategoryByName = new Map(
    ingredientCategories.map((category) => [category.name, category])
  );
  const recipeCategoryByName = new Map(
    recipeCategories.map((category) => [category.name, category])
  );
  const storageAreaByName = new Map(
    storageAreas.map((area) => [area.name, area])
  );

  const ingredientRecords = await Promise.all(
    ingredientSeed.map((ingredient) =>
      prisma.ingredient.upsert({
        where: { userId_name: { userId: user.id, name: ingredient.name } },
        update: {
          description: ingredient.description,
          purchaseUnit: ingredient.purchaseUnit,
          purchaseQty: ingredient.purchaseQty,
          purchasePrice: ingredient.purchasePrice,
          recipeUnit: ingredient.recipeUnit,
          conversionFactor: ingredient.conversionFactor,
          yieldPercent: ingredient.yieldPercent,
          minStockLevel: ingredient.minStockLevel,
          currentStock: ingredient.currentStock,
          storageAreaId: storageAreaByName.get(ingredient.storageArea)?.id
        },
        create: {
          userId: user.id,
          name: ingredient.name,
          description: ingredient.description,
          purchaseUnit: ingredient.purchaseUnit,
          purchaseQty: ingredient.purchaseQty,
          purchasePrice: ingredient.purchasePrice,
          recipeUnit: ingredient.recipeUnit,
          conversionFactor: ingredient.conversionFactor,
          yieldPercent: ingredient.yieldPercent,
          minStockLevel: ingredient.minStockLevel,
          currentStock: ingredient.currentStock,
          storageAreaId: storageAreaByName.get(ingredient.storageArea)?.id
        }
      })
    )
  );

  const ingredientByName = new Map(
    ingredientRecords.map((ingredient) => [ingredient.name, ingredient])
  );

  await prisma.ingredientCategoryAssignment.createMany({
    data: ingredientSeed.map((ingredient) => ({
      ingredientId: ingredientByName.get(ingredient.name)!.id,
      categoryId: ingredientCategoryByName.get(ingredient.category)!.id
    })),
    skipDuplicates: true
  });

  const recipe = await prisma.recipe.upsert({
    where: { userId_name: { userId: user.id, name: 'Tomato Basil Soup' } },
    update: {
      description: 'Creamy tomato soup finished with basil and olive oil.',
      yieldQty: dec('8'),
      yieldUnit: 'servings',
      prepTime: 15,
      cookTime: 30,
      instructions:
        'Sweat aromatics, add tomatoes, simmer, blend, and finish with dairy.',
      notes: 'Serve with toasted sourdough.'
    },
    create: {
      userId: user.id,
      name: 'Tomato Basil Soup',
      description: 'Creamy tomato soup finished with basil and olive oil.',
      yieldQty: dec('8'),
      yieldUnit: 'servings',
      prepTime: 15,
      cookTime: 30,
      instructions:
        'Sweat aromatics, add tomatoes, simmer, blend, and finish with dairy.',
      notes: 'Serve with toasted sourdough.'
    }
  });

  await prisma.recipeCategoryAssignment.deleteMany({
    where: { recipeId: recipe.id }
  });

  await prisma.recipeCategoryAssignment.createMany({
    data: ['Main Courses'].map((categoryName) => ({
      recipeId: recipe.id,
      categoryId: recipeCategoryByName.get(categoryName)!.id
    })),
    skipDuplicates: true
  });

  await prisma.recipeItem.deleteMany({
    where: { recipeId: recipe.id }
  });

  await prisma.recipeItem.createMany({
    data: [
      {
        recipeId: recipe.id,
        ingredientId: ingredientByName.get('Roma Tomatoes')!.id,
        quantity: dec('24.000'),
        unit: 'oz',
        sortOrder: 1
      },
      {
        recipeId: recipe.id,
        ingredientId: ingredientByName.get('Olive Oil')!.id,
        quantity: dec('2.000'),
        unit: 'oz',
        sortOrder: 2
      },
      {
        recipeId: recipe.id,
        ingredientId: ingredientByName.get('Paprika')!.id,
        quantity: dec('0.100'),
        unit: 'oz',
        sortOrder: 3
      },
      {
        recipeId: recipe.id,
        ingredientId: ingredientByName.get('Whole Milk')!.id,
        quantity: dec('8.000'),
        unit: 'oz',
        sortOrder: 4
      }
    ]
  });
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });