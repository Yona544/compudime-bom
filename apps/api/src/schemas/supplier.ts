import { z } from 'zod';

const preferredOrderMethods = ['phone', 'email', 'fax', 'online', 'in_person'] as const;

export const createSupplierBodySchema = z.object({
  name: z.string().min(1).max(255),
  contactName: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().max(255).optional(),
  address: z.string().optional(),
  customerNumber: z.string().max(50).optional(),
  salesRepFirstName: z.string().max(100).optional(),
  salesRepLastName: z.string().max(100).optional(),
  salesRepEmail: z.string().email().max(255).optional(),
  salesRepPhone: z.string().max(50).optional(),
  preferredOrderMethod: z.enum(preferredOrderMethods).optional(),
  deliveryDays: z.array(z.string()).optional(),
  notes: z.string().optional()
});

export const updateSupplierBodySchema = createSupplierBodySchema.partial();

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const paginationQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional()
});

export const createSupplierSchema = z.object({
  body: createSupplierBodySchema,
  params: z.object({}),
  query: z.object({})
});

export const updateSupplierSchema = z.object({
  body: updateSupplierBodySchema,
  params: idParamSchema,
  query: z.object({})
});

export const getSupplierSchema = z.object({
  body: z.object({}),
  params: idParamSchema,
  query: z.object({})
});

export const deleteSupplierSchema = z.object({
  body: z.object({}),
  params: idParamSchema,
  query: z.object({})
});

export const listSuppliersSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: paginationQuerySchema
});

export type CreateSupplierBody = z.infer<typeof createSupplierBodySchema>;
export type UpdateSupplierBody = z.infer<typeof updateSupplierBodySchema>;
