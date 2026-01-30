import { z } from 'zod';

// Recipe Item schemas
export const recipeItemCreateSchema = z.object({
  ingredientId: z.number().int().positive().optional(),
  subRecipeId: z.number().int().positive().optional(),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(50),
  sortOrder: z.number().int().min(0).default(0),
  notes: z.string().max(255).optional()
}).refine(
  (data) => (data.ingredientId != null) !== (data.subRecipeId != null),
  { message: 'Exactly one of ingredientId or subRecipeId must be provided' }
);

// Recipe schemas
export const createRecipeBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  yieldQty: z.number().positive(),
  yieldUnit: z.string().max(50).default('portion'),
  prepTime: z.number().int().min(0).optional(),
  cookTime: z.number().int().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  targetCostPct: z.number().min(0).max(100).default(30),
  instructions: z.string().optional(),
  notes: z.string().optional(),
  categoryIds: z.array(z.number().int().positive()).optional(),
  items: z.array(recipeItemCreateSchema).default([])
});

export const updateRecipeBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  yieldQty: z.number().positive().optional(),
  yieldUnit: z.string().max(50).optional(),
  prepTime: z.number().int().min(0).optional(),
  cookTime: z.number().int().min(0).optional(),
  sellingPrice: z.number().min(0).optional(),
  targetCostPct: z.number().min(0).max(100).optional(),
  instructions: z.string().optional(),
  notes: z.string().optional(),
  categoryIds: z.array(z.number().int().positive()).optional()
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const itemIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  itemId: z.coerce.number().int().positive()
});

export const paginationQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  categoryId: z.coerce.number().int().positive().optional()
});

export const scaleBodySchema = z.object({
  portions: z.number().positive()
});

export const updateCategoriesBodySchema = z.object({
  categoryIds: z.array(z.number().int().positive())
});

// Full request schemas
export const createRecipeSchema = z.object({
  body: createRecipeBodySchema,
  params: z.object({}),
  query: z.object({})
});

export const updateRecipeSchema = z.object({
  body: updateRecipeBodySchema,
  params: idParamSchema,
  query: z.object({})
});

export const getRecipeSchema = z.object({
  body: z.object({}),
  params: idParamSchema,
  query: z.object({})
});

export const deleteRecipeSchema = z.object({
  body: z.object({}),
  params: idParamSchema,
  query: z.object({})
});

export const listRecipesSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: paginationQuerySchema
});

export const addItemSchema = z.object({
  body: recipeItemCreateSchema,
  params: idParamSchema,
  query: z.object({})
});

export const removeItemSchema = z.object({
  body: z.object({}),
  params: itemIdParamSchema,
  query: z.object({})
});

export const scaleRecipeSchema = z.object({
  body: scaleBodySchema,
  params: idParamSchema,
  query: z.object({})
});

export const getCostSchema = z.object({
  body: z.object({}),
  params: idParamSchema,
  query: z.object({
    portions: z.coerce.number().positive().optional()
  })
});

export const updateCategoriesSchema = z.object({
  body: updateCategoriesBodySchema,
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
export type CreateRecipeBody = z.infer<typeof createRecipeBodySchema>;
export type UpdateRecipeBody = z.infer<typeof updateRecipeBodySchema>;
export type RecipeItemCreate = z.infer<typeof recipeItemCreateSchema>;
export type ScaleBody = z.infer<typeof scaleBodySchema>;
export type CreateCategoryBody = z.infer<typeof createCategoryBodySchema>;
