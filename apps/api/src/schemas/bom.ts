import { z } from 'zod';

export const bomRecipeRequestSchema = z.object({
  recipeId: z.number().int().positive(),
  portions: z.number().positive()
});

export const generateBomBodySchema = z.object({
  name: z.string().min(1).max(255),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  recipes: z.array(bomRecipeRequestSchema).min(1),
  scaleFactor: z.number().positive().default(1)
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const paginationQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const generateBomSchema = z.object({
  body: generateBomBodySchema,
  params: z.object({}),
  query: z.object({})
});

export const getBomSchema = z.object({
  body: z.object({}),
  params: idParamSchema,
  query: z.object({})
});

export const deleteBomSchema = z.object({
  body: z.object({}),
  params: idParamSchema,
  query: z.object({})
});

export const listBomsSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: paginationQuerySchema
});

export type GenerateBomBody = z.infer<typeof generateBomBodySchema>;
export type BomRecipeRequest = z.infer<typeof bomRecipeRequestSchema>;
