import { z } from 'zod';

// Shared schemas
export const paginationQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

// Ingredient schemas
export const createIngredientBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  purchaseUnit: z.string().min(1).max(50),
  purchaseQty: z.number().positive(),
  purchasePrice: z.number().min(0),
  recipeUnit: z.string().min(1).max(50),
  conversionFactor: z.number().positive(),
  yieldPercent: z.number().min(0).max(100).default(100),
  minStockLevel: z.number().min(0).optional(),
  currentStock: z.number().min(0).optional(),
  supplierId: z.number().int().positive().optional(),
  storageAreaId: z.number().int().positive().optional(),
  allergens: z.object({
    contains: z.array(z.string()).optional(),
    mayContain: z.array(z.string()).optional()
  }).optional(),
  nutrition: z.record(z.unknown()).optional(),
  notes: z.string().max(2000).optional(),
  categoryIds: z.array(z.number().int().positive()).optional()
});

export const updateIngredientBodySchema = createIngredientBodySchema.partial();

export const createIngredientSchema = z.object({
  body: createIngredientBodySchema,
  params: z.object({}),
  query: z.object({})
});

export const updateIngredientSchema = z.object({
  body: updateIngredientBodySchema,
  params: idParamSchema,
  query: z.object({})
});

export const getIngredientSchema = z.object({
  body: z.object({}),
  params: idParamSchema,
  query: z.object({})
});

export const deleteIngredientSchema = z.object({
  body: z.object({}),
  params: idParamSchema,
  query: z.object({})
});

export const listIngredientsSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: paginationQuerySchema.extend({
    search: z.string().optional(),
    categoryId: z.coerce.number().int().positive().optional()
  })
});

export const lowStockSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: paginationQuerySchema
});

export const updateCategoriesSchema = z.object({
  body: z.object({
    categoryIds: z.array(z.number().int().positive())
  }),
  params: idParamSchema,
  query: z.object({})
});

// Category schemas
export const createCategoryBodySchema = z.object({
  name: z.string().min(1).max(100),
  sortOrder: z.number().int().min(0).default(0)
});

export const createCategorySchema = z.object({
  body: createCategoryBodySchema,
  params: z.object({}),
  query: z.object({})
});

export const listCategoriesSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({})
});

// Type exports
export type CreateIngredientBody = z.infer<typeof createIngredientBodySchema>;
export type UpdateIngredientBody = z.infer<typeof updateIngredientBodySchema>;
export type CreateCategoryBody = z.infer<typeof createCategoryBodySchema>;
