import { Router, type Request, type Response, type NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validation.js';
import { getIngredientUnitCost, CostCalculationError } from '../services/cost-calculator.js';
import {
  createIngredientSchema,
  updateIngredientSchema,
  getIngredientSchema,
  deleteIngredientSchema,
  listIngredientsSchema,
  lowStockSchema,
  updateCategoriesSchema,
  type CreateIngredientBody,
  type UpdateIngredientBody
} from '../schemas/ingredient.js';

const router = Router();

// Helper to get userId from request (temporary until auth)
function getUserId(req: Request, res: Response): string | null {
  const userId = req.headers['x-user-id'] as string | undefined;
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized: X-User-Id header required' });
    return null;
  }
  return userId;
}

// Helper to format ingredient response
function formatIngredientResponse(
  ingredient: Prisma.IngredientGetPayload<{
    include: { categories: { include: { category: true } } }
  }>
): Record<string, unknown> {
  let unitCost: string | null = null;
  try {
    unitCost = getIngredientUnitCost(ingredient).toFixed(4);
  } catch (err) {
    if (!(err instanceof CostCalculationError)) throw err;
    // unitCost remains null if calculation fails
  }

  return {
    id: ingredient.id,
    userId: ingredient.userId,
    name: ingredient.name,
    description: ingredient.description,
    purchaseUnit: ingredient.purchaseUnit,
    purchaseQty: ingredient.purchaseQty.toString(),
    purchasePrice: ingredient.purchasePrice.toString(),
    recipeUnit: ingredient.recipeUnit,
    conversionFactor: ingredient.conversionFactor.toString(),
    yieldPercent: ingredient.yieldPercent.toString(),
    minStockLevel: ingredient.minStockLevel?.toString() ?? null,
    currentStock: ingredient.currentStock?.toString() ?? null,
    supplierId: ingredient.supplierId,
    storageAreaId: ingredient.storageAreaId,
    allergens: ingredient.allergens,
    nutrition: ingredient.nutrition,
    notes: ingredient.notes,
    createdAt: ingredient.createdAt.toISOString(),
    updatedAt: ingredient.updatedAt.toISOString(),
    categories: ingredient.categories.map(ca => ({
      id: ca.category.id,
      name: ca.category.name,
      sortOrder: ca.category.sortOrder
    })),
    unitCost
  };
}

// Include clause for categories
const includeCategories = {
  categories: {
    include: { category: true }
  }
} as const;

// POST /ingredients - Create ingredient
router.post(
  '/',
  validate(createIngredientSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const body = req.body as CreateIngredientBody;
      const { categoryIds, ...ingredientData } = body;

      // Check for duplicate name
      const existing = await prisma.ingredient.findUnique({
        where: { userId_name: { userId, name: ingredientData.name } }
      });
      if (existing) {
        return res.status(409).json({ error: 'Ingredient with this name already exists' });
      }

      const ingredient = await prisma.ingredient.create({
        data: {
          userId,
          name: ingredientData.name,
          description: ingredientData.description,
          purchaseUnit: ingredientData.purchaseUnit,
          purchaseQty: new Prisma.Decimal(ingredientData.purchaseQty),
          purchasePrice: new Prisma.Decimal(ingredientData.purchasePrice),
          recipeUnit: ingredientData.recipeUnit,
          conversionFactor: new Prisma.Decimal(ingredientData.conversionFactor),
          yieldPercent: new Prisma.Decimal(ingredientData.yieldPercent ?? 100),
          minStockLevel: ingredientData.minStockLevel != null ? new Prisma.Decimal(ingredientData.minStockLevel) : null,
          currentStock: ingredientData.currentStock != null ? new Prisma.Decimal(ingredientData.currentStock) : null,
          supplierId: ingredientData.supplierId,
          storageAreaId: ingredientData.storageAreaId,
          allergens: (ingredientData.allergens ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          nutrition: (ingredientData.nutrition ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          notes: ingredientData.notes,
          categories: categoryIds && categoryIds.length > 0 ? {
            create: categoryIds.map(id => ({ categoryId: id }))
          } : undefined
        },
        include: includeCategories
      });

      // Re-fetch with includes to ensure categories are loaded
      const fullIngredient = await prisma.ingredient.findUniqueOrThrow({
        where: { id: ingredient.id },
        include: includeCategories
      });
      return res.status(201).json(formatIngredientResponse(fullIngredient));
    } catch (err) {
      return next(err);
    }
  }
);

// GET /ingredients - List ingredients
router.get(
  '/',
  validate(listIngredientsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      // Zod validation ensures these are parsed correctly
      const offset = Number(req.query.offset ?? 0);
      const limit = Number(req.query.limit ?? 20);
      const search = req.query.search as string | undefined;
      const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;

      const where: Prisma.IngredientWhereInput = { userId };

      if (search) {
        where.name = { contains: search, mode: 'insensitive' };
      }

      if (categoryId) {
        where.categories = { some: { categoryId } };
      }

      const [items, total] = await Promise.all([
        prisma.ingredient.findMany({
          where,
          include: includeCategories,
          skip: offset,
          take: limit,
          orderBy: { name: 'asc' }
        }),
        prisma.ingredient.count({ where })
      ]);

      return res.json({
        items: items.map(formatIngredientResponse),
        total,
        offset,
        limit
      });
    } catch (err) {
      return next(err);
    }
  }
);

// GET /ingredients/low-stock - List low-stock ingredients
router.get(
  '/low-stock',
  validate(lowStockSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const offset = Number(req.query.offset ?? 0);
      const limit = Number(req.query.limit ?? 20);

      // Find ingredients where currentStock < minStockLevel and both are set
      // Prisma doesn't support field-to-field comparison directly, so we use raw SQL filter
      const where: Prisma.IngredientWhereInput = {
        userId,
        minStockLevel: { not: null },
        currentStock: { not: null }
      };

      // Fetch all matching and filter in memory (for field comparison)
      const allItems = await prisma.ingredient.findMany({
        where,
        include: includeCategories,
        orderBy: { name: 'asc' }
      });

      const lowStockItems = allItems.filter(item => {
        if (item.currentStock === null || item.minStockLevel === null) return false;
        return item.currentStock.lessThan(item.minStockLevel);
      });

      const total = lowStockItems.length;
      const paginatedItems = lowStockItems.slice(offset, offset + limit);

      return res.json({
        items: paginatedItems.map(formatIngredientResponse),
        total,
        offset,
        limit
      });
    } catch (err) {
      return next(err);
    }
  }
);

// GET /ingredients/:id - Get ingredient by ID
router.get(
  '/:id',
  validate(getIngredientSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const id = req.params.id as unknown as number;

      const ingredient = await prisma.ingredient.findFirst({
        where: { id, userId },
        include: includeCategories
      });

      if (!ingredient) {
        return res.status(404).json({ error: 'Ingredient not found' });
      }

      return res.json(formatIngredientResponse(ingredient));
    } catch (err) {
      return next(err);
    }
  }
);

// PATCH /ingredients/:id - Update ingredient
router.patch(
  '/:id',
  validate(updateIngredientSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const id = req.params.id as unknown as number;
      const body = req.body as UpdateIngredientBody;

      // Check ingredient exists and belongs to user
      const existing = await prisma.ingredient.findFirst({
        where: { id, userId }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Ingredient not found' });
      }

      // Check for duplicate name if name is being changed
      if (body.name && body.name !== existing.name) {
        const duplicate = await prisma.ingredient.findFirst({
          where: { userId, name: body.name, id: { not: id } }
        });
        if (duplicate) {
          return res.status(409).json({ error: 'Ingredient with this name already exists' });
        }
      }

      const { categoryIds, ...updateData } = body;

      const dataToUpdate: Prisma.IngredientUpdateInput = {};

      if (updateData.name !== undefined) dataToUpdate.name = updateData.name;
      if (updateData.description !== undefined) dataToUpdate.description = updateData.description;
      if (updateData.purchaseUnit !== undefined) dataToUpdate.purchaseUnit = updateData.purchaseUnit;
      if (updateData.purchaseQty !== undefined) dataToUpdate.purchaseQty = new Prisma.Decimal(updateData.purchaseQty);
      if (updateData.purchasePrice !== undefined) dataToUpdate.purchasePrice = new Prisma.Decimal(updateData.purchasePrice);
      if (updateData.recipeUnit !== undefined) dataToUpdate.recipeUnit = updateData.recipeUnit;
      if (updateData.conversionFactor !== undefined) dataToUpdate.conversionFactor = new Prisma.Decimal(updateData.conversionFactor);
      if (updateData.yieldPercent !== undefined) dataToUpdate.yieldPercent = new Prisma.Decimal(updateData.yieldPercent);
      if (updateData.minStockLevel !== undefined) dataToUpdate.minStockLevel = updateData.minStockLevel != null ? new Prisma.Decimal(updateData.minStockLevel) : null;
      if (updateData.currentStock !== undefined) dataToUpdate.currentStock = updateData.currentStock != null ? new Prisma.Decimal(updateData.currentStock) : null;
      if (updateData.supplierId !== undefined) {
        dataToUpdate.supplier = updateData.supplierId 
          ? { connect: { id: updateData.supplierId } } 
          : { disconnect: true };
      }
      if (updateData.storageAreaId !== undefined) {
        dataToUpdate.storageArea = updateData.storageAreaId 
          ? { connect: { id: updateData.storageAreaId } } 
          : { disconnect: true };
      }
      if (updateData.allergens !== undefined) dataToUpdate.allergens = (updateData.allergens ?? Prisma.JsonNull) as Prisma.InputJsonValue;
      if (updateData.nutrition !== undefined) dataToUpdate.nutrition = (updateData.nutrition ?? Prisma.JsonNull) as Prisma.InputJsonValue;
      if (updateData.notes !== undefined) dataToUpdate.notes = updateData.notes;

      // Handle category updates if provided
      if (categoryIds !== undefined) {
        // Delete existing assignments and create new ones
        await prisma.ingredientCategoryAssignment.deleteMany({
          where: { ingredientId: id }
        });
        if (categoryIds.length > 0) {
          await prisma.ingredientCategoryAssignment.createMany({
            data: categoryIds.map(categoryId => ({
              ingredientId: id,
              categoryId
            }))
          });
        }
      }

      const ingredient = await prisma.ingredient.update({
        where: { id },
        data: dataToUpdate,
        include: includeCategories
      });

      return res.json(formatIngredientResponse(ingredient));
    } catch (err) {
      return next(err);
    }
  }
);

// DELETE /ingredients/:id - Delete ingredient
router.delete(
  '/:id',
  validate(deleteIngredientSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const id = req.params.id as unknown as number;

      const existing = await prisma.ingredient.findFirst({
        where: { id, userId }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Ingredient not found' });
      }

      await prisma.ingredient.delete({ where: { id } });

      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  }
);

// PUT /ingredients/:id/categories - Update ingredient categories
router.put(
  '/:id/categories',
  validate(updateCategoriesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const id = req.params.id as unknown as number;
      const { categoryIds } = req.body as { categoryIds: number[] };

      const existing = await prisma.ingredient.findFirst({
        where: { id, userId }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Ingredient not found' });
      }

      // Delete all existing assignments
      await prisma.ingredientCategoryAssignment.deleteMany({
        where: { ingredientId: id }
      });

      // Create new assignments
      if (categoryIds.length > 0) {
        await prisma.ingredientCategoryAssignment.createMany({
          data: categoryIds.map(categoryId => ({
            ingredientId: id,
            categoryId
          }))
        });
      }

      // Fetch updated ingredient
      const ingredient = await prisma.ingredient.findUnique({
        where: { id },
        include: includeCategories
      });

      return res.json(formatIngredientResponse(ingredient!));
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
