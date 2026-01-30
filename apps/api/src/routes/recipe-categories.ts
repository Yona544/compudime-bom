import { Router, type Request, type Response, type NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validation.js';
import {
  createCategorySchema,
  listCategoriesSchema,
  type CreateCategoryBody
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

// GET /recipe-categories - List categories
router.get(
  '/',
  validate(listCategoriesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const categories = await prisma.recipeCategory.findMany({
        where: { userId },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          sortOrder: true
        }
      });

      return res.json({ items: categories });
    } catch (err) {
      return next(err);
    }
  }
);

// POST /recipe-categories - Create category
router.post(
  '/',
  validate(createCategorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const body = req.body as CreateCategoryBody;

      // Check for duplicate name
      const existing = await prisma.recipeCategory.findUnique({
        where: { userId_name: { userId, name: body.name } }
      });
      if (existing) {
        return res.status(409).json({ error: 'Category with this name already exists' });
      }

      const category = await prisma.recipeCategory.create({
        data: {
          userId,
          name: body.name,
          sortOrder: body.sortOrder ?? 0
        },
        select: {
          id: true,
          name: true,
          sortOrder: true
        }
      });

      return res.status(201).json(category);
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
