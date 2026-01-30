import { Router, type Request, type Response, type NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validation.js';
import { calculateRecipeCost, getIngredientUnitCost, CostCalculationError, RecipeCycleError } from '../services/cost-calculator.js';
import {
  createRecipeSchema,
  updateRecipeSchema,
  getRecipeSchema,
  deleteRecipeSchema,
  listRecipesSchema,
  addItemSchema,
  removeItemSchema,
  scaleRecipeSchema,
  getCostSchema,
  updateCategoriesSchema,
  type CreateRecipeBody,
  type UpdateRecipeBody,
  type RecipeItemCreate,
  type ScaleBody
} from '../schemas/recipe.js';

const router = Router();

// Helper to get userId from request
function getUserId(req: Request, res: Response): string | null {
  const userId = req.headers['x-user-id'] as string | undefined;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized: X-User-Id header required' });
    return null;
  }
  return userId;
}

// Include clause for full recipe with items and relations
const includeFullRecipe = {
  items: {
    include: {
      ingredient: true,
      subRecipe: true
    },
    orderBy: { sortOrder: 'asc' as const }
  },
  categories: {
    include: { category: true }
  }
} as const;

type FullRecipe = Prisma.RecipeGetPayload<{ include: typeof includeFullRecipe }>;

// Calculate costs for a recipe
function calculateCosts(recipe: FullRecipe): {
  totalCost: string | null;
  costPerPortion: string | null;
  foodCostPct: string | null;
  itemCosts: Record<number, string>;
} {
  const itemCosts: Record<number, string> = {};
  let totalCost = new Decimal(0);
  let hasError = false;

  for (const item of recipe.items) {
    try {
      if (item.ingredient) {
        const unitCost = getIngredientUnitCost(item.ingredient, item.unit);
        const itemTotal = unitCost.mul(item.quantity.toString());
        itemCosts[item.id] = itemTotal.toFixed(4);
        totalCost = totalCost.plus(itemTotal);
      } else if (item.subRecipe) {
        // For sub-recipes, we'd need to recursively calculate
        // For now, mark as needing full calculation
        hasError = true;
      }
    } catch (err) {
      if (err instanceof CostCalculationError) {
        hasError = true;
      } else {
        throw err;
      }
    }
  }

  if (hasError) {
    return { totalCost: null, costPerPortion: null, foodCostPct: null, itemCosts };
  }

  const yieldQty = new Decimal(recipe.yieldQty.toString());
  const costPerPortion = yieldQty.isZero() ? null : totalCost.div(yieldQty);
  
  let foodCostPct: Decimal | null = null;
  if (recipe.sellingPrice && costPerPortion) {
    const sellingPrice = new Decimal(recipe.sellingPrice.toString());
    if (!sellingPrice.isZero()) {
      foodCostPct = costPerPortion.div(sellingPrice).mul(100);
    }
  }

  return {
    totalCost: totalCost.toFixed(2),
    costPerPortion: costPerPortion?.toFixed(4) ?? null,
    foodCostPct: foodCostPct?.toFixed(2) ?? null,
    itemCosts
  };
}

// Format recipe response
function formatRecipeResponse(recipe: FullRecipe): Record<string, unknown> {
  const costs = calculateCosts(recipe);
  
  return {
    id: recipe.id,
    userId: recipe.userId,
    name: recipe.name,
    description: recipe.description,
    yieldQty: recipe.yieldQty.toString(),
    yieldUnit: recipe.yieldUnit,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    sellingPrice: recipe.sellingPrice?.toString() ?? null,
    targetCostPct: recipe.targetCostPct?.toString() ?? null,
    instructions: recipe.instructions,
    notes: recipe.notes,
    isActive: recipe.isActive,
    createdAt: recipe.createdAt.toISOString(),
    updatedAt: recipe.updatedAt.toISOString(),
    categories: recipe.categories.map(ca => ({
      id: ca.category.id,
      name: ca.category.name,
      sortOrder: ca.category.sortOrder
    })),
    items: recipe.items.map(item => ({
      id: item.id,
      recipeId: item.recipeId,
      ingredientId: item.ingredientId,
      subRecipeId: item.subRecipeId,
      quantity: item.quantity.toString(),
      unit: item.unit,
      sortOrder: item.sortOrder,
      notes: item.notes,
      ingredientName: item.ingredient?.name ?? null,
      subRecipeName: item.subRecipe?.name ?? null,
      itemCost: costs.itemCosts[item.id] ?? null
    })),
    totalCost: costs.totalCost,
    costPerPortion: costs.costPerPortion,
    foodCostPct: costs.foodCostPct
  };
}

// POST /recipes - Create recipe
router.post(
  '/',
  validate(createRecipeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const body = req.body as CreateRecipeBody;
      const { categoryIds, items, ...recipeData } = body;

      // Check for duplicate name
      const existing = await prisma.recipe.findUnique({
        where: { userId_name: { userId, name: recipeData.name } }
      });
      if (existing) {
        return res.status(409).json({ error: 'Recipe with this name already exists' });
      }

      // Create recipe with items
      const recipe = await prisma.recipe.create({
        data: {
          userId,
          name: recipeData.name,
          description: recipeData.description,
          yieldQty: new Prisma.Decimal(recipeData.yieldQty),
          yieldUnit: recipeData.yieldUnit ?? 'portion',
          prepTime: recipeData.prepTime,
          cookTime: recipeData.cookTime,
          sellingPrice: recipeData.sellingPrice != null ? new Prisma.Decimal(recipeData.sellingPrice) : null,
          targetCostPct: recipeData.targetCostPct != null ? new Prisma.Decimal(recipeData.targetCostPct) : null,
          instructions: recipeData.instructions,
          notes: recipeData.notes,
          categories: categoryIds && categoryIds.length > 0 ? {
            create: categoryIds.map(id => ({ categoryId: id }))
          } : undefined,
          items: items.length > 0 ? {
            create: items.map((item, idx) => ({
              ingredientId: item.ingredientId,
              subRecipeId: item.subRecipeId,
              quantity: new Prisma.Decimal(item.quantity),
              unit: item.unit,
              sortOrder: item.sortOrder ?? idx,
              notes: item.notes
            }))
          } : undefined
        },
        include: includeFullRecipe
      });

      return res.status(201).json(formatRecipeResponse(recipe));
    } catch (err) {
      return next(err);
    }
  }
);

// GET /recipes - List recipes
router.get(
  '/',
  validate(listRecipesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const offset = Number(req.query.offset ?? 0);
      const limit = Number(req.query.limit ?? 20);
      const search = req.query.search as string | undefined;
      const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;

      const where: Prisma.RecipeWhereInput = { userId };

      if (search) {
        where.name = { contains: search, mode: 'insensitive' };
      }

      if (categoryId) {
        where.categories = { some: { categoryId } };
      }

      const [items, total] = await Promise.all([
        prisma.recipe.findMany({
          where,
          include: includeFullRecipe,
          skip: offset,
          take: limit,
          orderBy: { name: 'asc' }
        }),
        prisma.recipe.count({ where })
      ]);

      return res.json({
        items: items.map(formatRecipeResponse),
        total,
        offset,
        limit
      });
    } catch (err) {
      return next(err);
    }
  }
);

// GET /recipes/:id - Get recipe by ID
router.get(
  '/:id',
  validate(getRecipeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const id = Number(req.params.id);

      const recipe = await prisma.recipe.findFirst({
        where: { id, userId },
        include: includeFullRecipe
      });

      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }

      return res.json(formatRecipeResponse(recipe));
    } catch (err) {
      return next(err);
    }
  }
);

// PATCH /recipes/:id - Update recipe
router.patch(
  '/:id',
  validate(updateRecipeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const id = Number(req.params.id);
      const body = req.body as UpdateRecipeBody;

      const existing = await prisma.recipe.findFirst({
        where: { id, userId }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Recipe not found' });
      }

      // Check for duplicate name
      if (body.name && body.name !== existing.name) {
        const duplicate = await prisma.recipe.findFirst({
          where: { userId, name: body.name, id: { not: id } }
        });
        if (duplicate) {
          return res.status(409).json({ error: 'Recipe with this name already exists' });
        }
      }

      const { categoryIds, ...updateData } = body;

      // Handle category updates
      if (categoryIds !== undefined) {
        await prisma.recipeCategoryAssignment.deleteMany({
          where: { recipeId: id }
        });
        if (categoryIds.length > 0) {
          await prisma.recipeCategoryAssignment.createMany({
            data: categoryIds.map(categoryId => ({ recipeId: id, categoryId }))
          });
        }
      }

      const recipe = await prisma.recipe.update({
        where: { id },
        data: {
          name: updateData.name,
          description: updateData.description,
          yieldQty: updateData.yieldQty != null ? new Prisma.Decimal(updateData.yieldQty) : undefined,
          yieldUnit: updateData.yieldUnit,
          prepTime: updateData.prepTime,
          cookTime: updateData.cookTime,
          sellingPrice: updateData.sellingPrice != null ? new Prisma.Decimal(updateData.sellingPrice) : undefined,
          targetCostPct: updateData.targetCostPct != null ? new Prisma.Decimal(updateData.targetCostPct) : undefined,
          instructions: updateData.instructions,
          notes: updateData.notes
        },
        include: includeFullRecipe
      });

      return res.json(formatRecipeResponse(recipe));
    } catch (err) {
      return next(err);
    }
  }
);

// DELETE /recipes/:id - Delete recipe
router.delete(
  '/:id',
  validate(deleteRecipeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const id = Number(req.params.id);

      const existing = await prisma.recipe.findFirst({
        where: { id, userId }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Recipe not found' });
      }

      // Check if used as sub-recipe
      const usedAsSubRecipe = await prisma.recipeItem.findFirst({
        where: { subRecipeId: id }
      });
      if (usedAsSubRecipe) {
        return res.status(400).json({ 
          error: 'Cannot delete recipe: it is used as a sub-recipe in another recipe' 
        });
      }

      await prisma.recipe.delete({ where: { id } });

      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  }
);

// POST /recipes/:id/items - Add item to recipe
router.post(
  '/:id/items',
  validate(addItemSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const recipeId = Number(req.params.id);
      const body = req.body as RecipeItemCreate;

      const recipe = await prisma.recipe.findFirst({
        where: { id: recipeId, userId }
      });

      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }

      // Check for cycle if adding sub-recipe
      if (body.subRecipeId) {
        if (body.subRecipeId === recipeId) {
          return res.status(400).json({ error: 'Recipe cannot contain itself' });
        }
        // TODO: Check for deeper cycles
      }

      const item = await prisma.recipeItem.create({
        data: {
          recipeId,
          ingredientId: body.ingredientId,
          subRecipeId: body.subRecipeId,
          quantity: new Prisma.Decimal(body.quantity),
          unit: body.unit,
          sortOrder: body.sortOrder ?? 0,
          notes: body.notes
        },
        include: {
          ingredient: true,
          subRecipe: true
        }
      });

      return res.status(201).json({
        id: item.id,
        recipeId: item.recipeId,
        ingredientId: item.ingredientId,
        subRecipeId: item.subRecipeId,
        quantity: item.quantity.toString(),
        unit: item.unit,
        sortOrder: item.sortOrder,
        notes: item.notes,
        ingredientName: item.ingredient?.name ?? null,
        subRecipeName: item.subRecipe?.name ?? null
      });
    } catch (err) {
      return next(err);
    }
  }
);

// DELETE /recipes/:id/items/:itemId - Remove item from recipe
router.delete(
  '/:id/items/:itemId',
  validate(removeItemSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const recipeId = Number(req.params.id);
      const itemId = Number(req.params.itemId);

      const recipe = await prisma.recipe.findFirst({
        where: { id: recipeId, userId }
      });

      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }

      const item = await prisma.recipeItem.findFirst({
        where: { id: itemId, recipeId }
      });

      if (!item) {
        return res.status(404).json({ error: 'Recipe item not found' });
      }

      await prisma.recipeItem.delete({ where: { id: itemId } });

      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  }
);

// POST /recipes/:id/scale - Scale recipe
router.post(
  '/:id/scale',
  validate(scaleRecipeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const recipeId = Number(req.params.id);
      const body = req.body as ScaleBody;

      const recipe = await prisma.recipe.findFirst({
        where: { id: recipeId, userId },
        include: includeFullRecipe
      });

      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }

      const originalYield = new Decimal(recipe.yieldQty.toString());
      const targetYield = new Decimal(body.portions);
      const scaleFactor = targetYield.div(originalYield);

      const scaledItems = recipe.items.map(item => {
        const originalQty = new Decimal(item.quantity.toString());
        const scaledQty = originalQty.mul(scaleFactor);
        
        return {
          id: item.id,
          name: item.ingredient?.name ?? item.subRecipe?.name,
          type: item.ingredient ? 'ingredient' : 'sub_recipe',
          originalQuantity: item.quantity.toString(),
          scaledQuantity: scaledQty.toFixed(3),
          unit: item.unit
        };
      });

      // Calculate scaled costs
      const costs = calculateCosts(recipe);
      const scaledTotalCost = costs.totalCost 
        ? new Decimal(costs.totalCost).mul(scaleFactor).toFixed(2) 
        : null;

      return res.json({
        recipeId: recipe.id,
        recipeName: recipe.name,
        originalYield: originalYield.toString(),
        targetYield: targetYield.toString(),
        scaleFactor: scaleFactor.toFixed(4),
        items: scaledItems,
        totalCost: scaledTotalCost,
        costPerPortion: costs.costPerPortion
      });
    } catch (err) {
      return next(err);
    }
  }
);

// GET /recipes/:id/cost - Get cost breakdown
router.get(
  '/:id/cost',
  validate(getCostSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const recipeId = Number(req.params.id);

      const recipe = await prisma.recipe.findFirst({
        where: { id: recipeId, userId },
        include: includeFullRecipe
      });

      if (!recipe) {
        return res.status(404).json({ error: 'Recipe not found' });
      }

      const costs = calculateCosts(recipe);

      return res.json({
        recipeId: recipe.id,
        recipeName: recipe.name,
        yieldQty: recipe.yieldQty.toString(),
        yieldUnit: recipe.yieldUnit,
        totalCost: costs.totalCost,
        costPerPortion: costs.costPerPortion,
        foodCostPct: costs.foodCostPct,
        targetCostPct: recipe.targetCostPct?.toString() ?? null,
        sellingPrice: recipe.sellingPrice?.toString() ?? null,
        items: recipe.items.map(item => ({
          id: item.id,
          name: item.ingredient?.name ?? item.subRecipe?.name,
          type: item.ingredient ? 'ingredient' : 'sub_recipe',
          quantity: item.quantity.toString(),
          unit: item.unit,
          cost: costs.itemCosts[item.id] ?? null
        }))
      });
    } catch (err) {
      return next(err);
    }
  }
);

// PUT /recipes/:id/categories - Update recipe categories
router.put(
  '/:id/categories',
  validate(updateCategoriesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const recipeId = Number(req.params.id);
      const { categoryIds } = req.body as { categoryIds: number[] };

      const existing = await prisma.recipe.findFirst({
        where: { id: recipeId, userId }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Recipe not found' });
      }

      // Delete existing and create new
      await prisma.recipeCategoryAssignment.deleteMany({
        where: { recipeId }
      });

      if (categoryIds.length > 0) {
        await prisma.recipeCategoryAssignment.createMany({
          data: categoryIds.map(categoryId => ({ recipeId, categoryId }))
        });
      }

      const recipe = await prisma.recipe.findUniqueOrThrow({
        where: { id: recipeId },
        include: includeFullRecipe
      });

      return res.json(formatRecipeResponse(recipe));
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
