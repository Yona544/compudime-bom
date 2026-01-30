import { Router, type Request, type Response, type NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validation.js';
import { getIngredientUnitCost, CostCalculationError } from '../services/cost-calculator.js';
import {
  generateBomSchema,
  getBomSchema,
  deleteBomSchema,
  listBomsSchema,
  type GenerateBomBody,
  type BomRecipeRequest
} from '../schemas/bom.js';

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

// Include clause for full BOM
const includeFullBom = {
  items: {
    include: {
      recipe: true,
      ingredient: true
    }
  }
} as const;

type FullBom = Prisma.BillOfMaterialsGetPayload<{ include: typeof includeFullBom }>;

// Format BOM response
function formatBomResponse(bom: FullBom): Record<string, unknown> {
  // Group items by ingredient for aggregation
  const ingredientMap = new Map<number, {
    ingredientId: number;
    ingredientName: string;
    totalQty: Decimal;
    unit: string;
    unitCost: Decimal | null;
    lineCost: Decimal | null;
    fromRecipes: { recipeId: number; recipeName: string; qty: string }[];
  }>();

  // Track recipes
  const recipeMap = new Map<number, { recipeId: number; recipeName: string; portions: string }>();

  for (const item of bom.items) {
    if (item.recipeId && item.recipe) {
      recipeMap.set(item.recipeId, {
        recipeId: item.recipeId,
        recipeName: item.recipe.name,
        portions: item.portions?.toString() ?? '0'
      });
    }

    if (item.ingredientId && item.ingredient) {
      const existing = ingredientMap.get(item.ingredientId);
      const qty = new Decimal(item.totalQty?.toString() ?? '0');
      const unitCost = item.unitCost ? new Decimal(item.unitCost.toString()) : null;
      const lineCost = item.lineCost ? new Decimal(item.lineCost.toString()) : null;

      if (existing) {
        existing.totalQty = existing.totalQty.plus(qty);
        if (lineCost && existing.lineCost) {
          existing.lineCost = existing.lineCost.plus(lineCost);
        }
        if (item.recipeId && item.recipe) {
          existing.fromRecipes.push({
            recipeId: item.recipeId,
            recipeName: item.recipe.name,
            qty: qty.toString()
          });
        }
      } else {
        ingredientMap.set(item.ingredientId, {
          ingredientId: item.ingredientId,
          ingredientName: item.ingredient.name,
          totalQty: qty,
          unit: item.unit ?? item.ingredient.recipeUnit,
          unitCost,
          lineCost,
          fromRecipes: item.recipeId && item.recipe ? [{
            recipeId: item.recipeId,
            recipeName: item.recipe.name,
            qty: qty.toString()
          }] : []
        });
      }
    }
  }

  return {
    id: bom.id,
    userId: bom.userId,
    name: bom.name,
    date: bom.date.toISOString().split('T')[0],
    totalCost: bom.totalCost?.toString() ?? null,
    createdAt: bom.createdAt.toISOString(),
    recipes: Array.from(recipeMap.values()),
    ingredients: Array.from(ingredientMap.values()).map(ing => ({
      ingredientId: ing.ingredientId,
      ingredientName: ing.ingredientName,
      totalQty: ing.totalQty.toString(),
      unit: ing.unit,
      unitCost: ing.unitCost?.toString() ?? null,
      lineCost: ing.lineCost?.toString() ?? null,
      fromRecipes: ing.fromRecipes
    })),
    items: bom.items.map(item => ({
      id: item.id,
      bomId: item.bomId,
      recipeId: item.recipeId,
      recipeName: item.recipe?.name ?? null,
      portions: item.portions?.toString() ?? null,
      ingredientId: item.ingredientId,
      ingredientName: item.ingredient?.name ?? null,
      totalQty: item.totalQty?.toString() ?? null,
      unit: item.unit,
      unitCost: item.unitCost?.toString() ?? null,
      lineCost: item.lineCost?.toString() ?? null
    }))
  };
}

// POST /bom/generate - Generate BOM from recipes
router.post(
  '/generate',
  validate(generateBomSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const body = req.body as GenerateBomBody;
      const scaleFactor = new Decimal(body.scaleFactor ?? 1);

      // Fetch all requested recipes with their items
      const recipeIds = body.recipes.map(r => r.recipeId);
      const recipes = await prisma.recipe.findMany({
        where: { id: { in: recipeIds }, userId },
        include: {
          items: {
            include: { ingredient: true }
          }
        }
      });

      // Verify all recipes exist and belong to user
      if (recipes.length !== recipeIds.length) {
        const foundIds = new Set(recipes.map(r => r.id));
        const missingIds = recipeIds.filter(id => !foundIds.has(id));
        return res.status(400).json({ error: `Recipes not found: ${missingIds.join(', ')}` });
      }

      // Build a map of recipe id -> portions
      const portionsMap = new Map<number, Decimal>();
      for (const req of body.recipes) {
        portionsMap.set(req.recipeId, new Decimal(req.portions).mul(scaleFactor));
      }

      // Create BOM items - one per recipe/ingredient combination
      const bomItemsData: Prisma.BOMItemCreateWithoutBomInput[] = [];
      let totalCost = new Decimal(0);

      for (const recipe of recipes) {
        const portions = portionsMap.get(recipe.id)!;
        const yieldQty = new Decimal(recipe.yieldQty.toString());
        const recipeScale = portions.div(yieldQty);

        for (const item of recipe.items) {
          if (!item.ingredient) continue;

          const scaledQty = new Decimal(item.quantity.toString()).mul(recipeScale);
          
          let unitCost: Decimal | null = null;
          let lineCost: Decimal | null = null;
          
          try {
            unitCost = getIngredientUnitCost(item.ingredient, item.unit);
            lineCost = scaledQty.mul(unitCost);
            totalCost = totalCost.plus(lineCost);
          } catch (err) {
            if (!(err instanceof CostCalculationError)) throw err;
          }

          bomItemsData.push({
            recipe: { connect: { id: recipe.id } },
            ingredient: { connect: { id: item.ingredientId! } },
            portions: new Prisma.Decimal(portions.toString()),
            totalQty: new Prisma.Decimal(scaledQty.toString()),
            unit: item.unit,
            unitCost: unitCost ? new Prisma.Decimal(unitCost.toFixed(4)) : null,
            lineCost: lineCost ? new Prisma.Decimal(lineCost.toFixed(2)) : null
          });
        }
      }

      // Create the BOM with all items
      const bom = await prisma.billOfMaterials.create({
        data: {
          userId,
          name: body.name,
          date: new Date(body.date),
          totalCost: new Prisma.Decimal(totalCost.toFixed(2)),
          items: {
            create: bomItemsData
          }
        },
        include: includeFullBom
      });

      return res.status(201).json(formatBomResponse(bom));
    } catch (err) {
      return next(err);
    }
  }
);

// GET /bom - List BOMs
router.get(
  '/',
  validate(listBomsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const offset = Number(req.query.offset ?? 0);
      const limit = Number(req.query.limit ?? 20);

      const [items, total] = await Promise.all([
        prisma.billOfMaterials.findMany({
          where: { userId },
          include: {
            items: {
              select: { recipeId: true, ingredientId: true }
            }
          },
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.billOfMaterials.count({ where: { userId } })
      ]);

      const summaries = items.map(bom => ({
        id: bom.id,
        name: bom.name,
        date: bom.date.toISOString().split('T')[0],
        totalCost: bom.totalCost?.toString() ?? null,
        recipeCount: new Set(bom.items.filter(i => i.recipeId).map(i => i.recipeId)).size,
        ingredientCount: bom.items.filter(i => i.ingredientId).length,
        createdAt: bom.createdAt.toISOString()
      }));

      return res.json({
        items: summaries,
        total,
        offset,
        limit
      });
    } catch (err) {
      return next(err);
    }
  }
);

// GET /bom/:id - Get BOM by ID
router.get(
  '/:id',
  validate(getBomSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const id = Number(req.params.id);

      const bom = await prisma.billOfMaterials.findFirst({
        where: { id, userId },
        include: includeFullBom
      });

      if (!bom) {
        return res.status(404).json({ error: 'BOM not found' });
      }

      return res.json(formatBomResponse(bom));
    } catch (err) {
      return next(err);
    }
  }
);

// DELETE /bom/:id - Delete BOM
router.delete(
  '/:id',
  validate(deleteBomSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const id = Number(req.params.id);

      const existing = await prisma.billOfMaterials.findFirst({
        where: { id, userId }
      });

      if (!existing) {
        return res.status(404).json({ error: 'BOM not found' });
      }

      await prisma.billOfMaterials.delete({ where: { id } });

      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
