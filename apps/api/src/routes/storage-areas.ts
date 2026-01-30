import { Router, type Request, type Response, type NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validation.js';
import {
  createStorageAreaSchema,
  updateStorageAreaSchema,
  getStorageAreaSchema,
  deleteStorageAreaSchema,
  listStorageAreasSchema,
  type CreateStorageAreaBody,
  type UpdateStorageAreaBody
} from '../schemas/storage-area.js';

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

// Format storage area response
function formatStorageAreaResponse(area: Prisma.StorageAreaGetPayload<object>): Record<string, unknown> {
  return {
    id: area.id,
    userId: area.userId,
    name: area.name,
    location: area.location,
    temperatureZone: area.temperatureZone,
    notes: area.notes,
    createdAt: area.createdAt.toISOString(),
    updatedAt: area.updatedAt.toISOString()
  };
}

// POST /storage-areas - Create storage area
router.post(
  '/',
  validate(createStorageAreaSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const body = req.body as CreateStorageAreaBody;

      // Check for duplicate name
      const existing = await prisma.storageArea.findUnique({
        where: { userId_name: { userId, name: body.name } }
      });
      if (existing) {
        return res.status(409).json({ error: 'Storage area with this name already exists' });
      }

      const area = await prisma.storageArea.create({
        data: {
          userId,
          name: body.name,
          location: body.location,
          temperatureZone: body.temperatureZone,
          notes: body.notes
        }
      });

      return res.status(201).json(formatStorageAreaResponse(area));
    } catch (err) {
      return next(err);
    }
  }
);

// GET /storage-areas - List storage areas
router.get(
  '/',
  validate(listStorageAreasSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const offset = Number(req.query.offset ?? 0);
      const limit = Number(req.query.limit ?? 20);
      const search = req.query.search as string | undefined;

      const where: Prisma.StorageAreaWhereInput = { userId };

      if (search) {
        where.name = { contains: search, mode: 'insensitive' };
      }

      const [items, total] = await Promise.all([
        prisma.storageArea.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { name: 'asc' }
        }),
        prisma.storageArea.count({ where })
      ]);

      return res.json({
        items: items.map(formatStorageAreaResponse),
        total,
        offset,
        limit
      });
    } catch (err) {
      return next(err);
    }
  }
);

// GET /storage-areas/:id - Get storage area by ID
router.get(
  '/:id',
  validate(getStorageAreaSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const id = Number(req.params.id);

      const area = await prisma.storageArea.findFirst({
        where: { id, userId }
      });

      if (!area) {
        return res.status(404).json({ error: 'Storage area not found' });
      }

      return res.json(formatStorageAreaResponse(area));
    } catch (err) {
      return next(err);
    }
  }
);

// PATCH /storage-areas/:id - Update storage area
router.patch(
  '/:id',
  validate(updateStorageAreaSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const id = Number(req.params.id);
      const body = req.body as UpdateStorageAreaBody;

      const existing = await prisma.storageArea.findFirst({
        where: { id, userId }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Storage area not found' });
      }

      // Check for duplicate name if name is being changed
      if (body.name && body.name !== existing.name) {
        const duplicate = await prisma.storageArea.findFirst({
          where: { userId, name: body.name, id: { not: id } }
        });
        if (duplicate) {
          return res.status(409).json({ error: 'Storage area with this name already exists' });
        }
      }

      const area = await prisma.storageArea.update({
        where: { id },
        data: {
          name: body.name,
          location: body.location,
          temperatureZone: body.temperatureZone,
          notes: body.notes
        }
      });

      return res.json(formatStorageAreaResponse(area));
    } catch (err) {
      return next(err);
    }
  }
);

// DELETE /storage-areas/:id - Delete storage area
router.delete(
  '/:id',
  validate(deleteStorageAreaSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const id = Number(req.params.id);

      const existing = await prisma.storageArea.findFirst({
        where: { id, userId }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Storage area not found' });
      }

      await prisma.storageArea.delete({ where: { id } });

      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
