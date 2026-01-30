import { Router, type Request, type Response, type NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validation.js';
import {
  createSupplierSchema,
  updateSupplierSchema,
  getSupplierSchema,
  deleteSupplierSchema,
  listSuppliersSchema,
  type CreateSupplierBody,
  type UpdateSupplierBody
} from '../schemas/supplier.js';

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

// Format supplier response
function formatSupplierResponse(supplier: Prisma.SupplierGetPayload<object>): Record<string, unknown> {
  return {
    id: supplier.id,
    userId: supplier.userId,
    name: supplier.name,
    contactName: supplier.contactName,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    customerNumber: supplier.customerNumber,
    salesRepFirstName: supplier.salesRepFirstName,
    salesRepLastName: supplier.salesRepLastName,
    salesRepEmail: supplier.salesRepEmail,
    salesRepPhone: supplier.salesRepPhone,
    preferredOrderMethod: supplier.preferredOrderMethod,
    deliveryDays: supplier.deliveryDays,
    notes: supplier.notes,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString()
  };
}

// POST /suppliers - Create supplier
router.post(
  '/',
  validate(createSupplierSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const body = req.body as CreateSupplierBody;

      // Check for duplicate name
      const existing = await prisma.supplier.findUnique({
        where: { userId_name: { userId, name: body.name } }
      });
      if (existing) {
        return res.status(409).json({ error: 'Supplier with this name already exists' });
      }

      const supplier = await prisma.supplier.create({
        data: {
          userId,
          name: body.name,
          contactName: body.contactName,
          phone: body.phone,
          email: body.email,
          address: body.address,
          customerNumber: body.customerNumber,
          salesRepFirstName: body.salesRepFirstName,
          salesRepLastName: body.salesRepLastName,
          salesRepEmail: body.salesRepEmail,
          salesRepPhone: body.salesRepPhone,
          preferredOrderMethod: body.preferredOrderMethod,
          deliveryDays: body.deliveryDays ?? [],
          notes: body.notes
        }
      });

      return res.status(201).json(formatSupplierResponse(supplier));
    } catch (err) {
      return next(err);
    }
  }
);

// GET /suppliers - List suppliers
router.get(
  '/',
  validate(listSuppliersSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const offset = Number(req.query.offset ?? 0);
      const limit = Number(req.query.limit ?? 20);
      const search = req.query.search as string | undefined;

      const where: Prisma.SupplierWhereInput = { userId };

      if (search) {
        where.name = { contains: search, mode: 'insensitive' };
      }

      const [items, total] = await Promise.all([
        prisma.supplier.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { name: 'asc' }
        }),
        prisma.supplier.count({ where })
      ]);

      return res.json({
        items: items.map(formatSupplierResponse),
        total,
        offset,
        limit
      });
    } catch (err) {
      return next(err);
    }
  }
);

// GET /suppliers/:id - Get supplier by ID
router.get(
  '/:id',
  validate(getSupplierSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const id = Number(req.params.id);

      const supplier = await prisma.supplier.findFirst({
        where: { id, userId }
      });

      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      return res.json(formatSupplierResponse(supplier));
    } catch (err) {
      return next(err);
    }
  }
);

// PATCH /suppliers/:id - Update supplier
router.patch(
  '/:id',
  validate(updateSupplierSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const id = Number(req.params.id);
      const body = req.body as UpdateSupplierBody;

      const existing = await prisma.supplier.findFirst({
        where: { id, userId }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      // Check for duplicate name if name is being changed
      if (body.name && body.name !== existing.name) {
        const duplicate = await prisma.supplier.findFirst({
          where: { userId, name: body.name, id: { not: id } }
        });
        if (duplicate) {
          return res.status(409).json({ error: 'Supplier with this name already exists' });
        }
      }

      const supplier = await prisma.supplier.update({
        where: { id },
        data: {
          name: body.name,
          contactName: body.contactName,
          phone: body.phone,
          email: body.email,
          address: body.address,
          customerNumber: body.customerNumber,
          salesRepFirstName: body.salesRepFirstName,
          salesRepLastName: body.salesRepLastName,
          salesRepEmail: body.salesRepEmail,
          salesRepPhone: body.salesRepPhone,
          preferredOrderMethod: body.preferredOrderMethod,
          deliveryDays: body.deliveryDays,
          notes: body.notes
        }
      });

      return res.json(formatSupplierResponse(supplier));
    } catch (err) {
      return next(err);
    }
  }
);

// DELETE /suppliers/:id - Delete supplier
router.delete(
  '/:id',
  validate(deleteSupplierSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getUserId(req, res);
      if (!userId) return;

      const id = Number(req.params.id);

      const existing = await prisma.supplier.findFirst({
        where: { id, userId }
      });

      if (!existing) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      await prisma.supplier.delete({ where: { id } });

      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
