import { z } from 'zod';

const temperatureZones = ['cold', 'frozen', 'dry', 'ambient'] as const;

export const createStorageAreaBodySchema = z.object({
  name: z.string().min(1).max(100),
  location: z.string().max(255).optional(),
  temperatureZone: z.enum(temperatureZones).optional(),
  notes: z.string().optional()
});

export const updateStorageAreaBodySchema = createStorageAreaBodySchema.partial();

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const paginationQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional()
});

export const createStorageAreaSchema = z.object({
  body: createStorageAreaBodySchema,
  params: z.object({}),
  query: z.object({})
});

export const updateStorageAreaSchema = z.object({
  body: updateStorageAreaBodySchema,
  params: idParamSchema,
  query: z.object({})
});

export const getStorageAreaSchema = z.object({
  body: z.object({}),
  params: idParamSchema,
  query: z.object({})
});

export const deleteStorageAreaSchema = z.object({
  body: z.object({}),
  params: idParamSchema,
  query: z.object({})
});

export const listStorageAreasSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: paginationQuerySchema
});

export type CreateStorageAreaBody = z.infer<typeof createStorageAreaBodySchema>;
export type UpdateStorageAreaBody = z.infer<typeof updateStorageAreaBodySchema>;
