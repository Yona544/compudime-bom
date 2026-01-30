import { Router } from 'express';
import ingredientsRouter from './ingredients.js';
import ingredientCategoriesRouter from './ingredient-categories.js';
import suppliersRouter from './suppliers.js';
import storageAreasRouter from './storage-areas.js';
import recipesRouter from './recipes.js';
import recipeCategoriesRouter from './recipe-categories.js';
import bomRouter from './bom.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    service: 'bom-api',
    status: 'ok'
  });
});

// V1 API routes
router.use('/v1/ingredients', ingredientsRouter);
router.use('/v1/ingredient-categories', ingredientCategoriesRouter);
router.use('/v1/suppliers', suppliersRouter);
router.use('/v1/storage-areas', storageAreasRouter);
router.use('/v1/recipes', recipesRouter);
router.use('/v1/recipe-categories', recipeCategoriesRouter);
router.use('/v1/bom', bomRouter);

export default router;
