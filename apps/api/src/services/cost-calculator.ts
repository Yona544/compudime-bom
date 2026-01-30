import { Decimal } from 'decimal.js';
type DecimalValue = string | number | bigint | InstanceType<typeof Decimal>;
import { convert, UnitConversionError } from './unit-converter.js';
import type { Ingredient, Recipe, RecipeItem } from '@prisma/client';

export class CostCalculationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CostCalculationError';
  }
}

export class RecipeCycleError extends CostCalculationError {
  constructor(message: string) {
    super(message);
    this.name = 'RecipeCycleError';
  }
}

type IngredientWithRelations = Ingredient;
type RecipeItemWithRelations = RecipeItem & {
  ingredient?: IngredientWithRelations | null;
  subRecipe?: RecipeWithRelations | null;
};
type RecipeWithRelations = Recipe & {
  items?: RecipeItemWithRelations[];
};

/**
 * Calculate the cost per unit of an ingredient.
 * 
 * Formula:
 *   base_cost = purchase_price / purchase_qty
 *   with_yield = base_cost / (yield_percent / 100)
 *   converted = with_yield * conversion_factor (if needed)
 */
export function getIngredientUnitCost(
  ingredient: IngredientWithRelations,
  targetUnit?: string | null
): Decimal {
  const unit = targetUnit ?? ingredient.recipeUnit;

  const purchasePrice = new Decimal(ingredient.purchasePrice.toString());
  const purchaseQty = new Decimal(ingredient.purchaseQty.toString());

  if (purchaseQty.isZero()) {
    throw new CostCalculationError(
      `Ingredient ${ingredient.name} has zero purchase quantity`
    );
  }

  const baseCostPerPurchaseUnit = purchasePrice.div(purchaseQty);

  const conversionFactor = new Decimal(ingredient.conversionFactor.toString());
  if (conversionFactor.isZero()) {
    throw new CostCalculationError(
      `Ingredient ${ingredient.name} has zero conversion factor`
    );
  }

  const costPerRecipeUnit = baseCostPerPurchaseUnit.div(conversionFactor);

  const yieldPercent = new Decimal(ingredient.yieldPercent.toString());
  if (yieldPercent.isZero()) {
    throw new CostCalculationError(
      `Ingredient ${ingredient.name} has zero yield percent`
    );
  }

  const costWithYield = costPerRecipeUnit.div(yieldPercent.div(100));

  const recipeUnit = ingredient.recipeUnit.toLowerCase().trim();
  const normalizedTargetUnit = unit.toLowerCase().trim();

  if (recipeUnit === normalizedTargetUnit) {
    return costWithYield;
  }

  try {
    const recipeUnitsPerTarget = convert(1, normalizedTargetUnit, recipeUnit);
    return costWithYield.mul(recipeUnitsPerTarget);
  } catch (error) {
    if (error instanceof UnitConversionError) {
      throw new CostCalculationError(
        `Cannot convert ${normalizedTargetUnit} to ${recipeUnit} for ${ingredient.name}: ${error.message}`
      );
    }
    throw error;
  }
}

/**
 * Calculate the cost of a single recipe item.
 */
export function calculateRecipeItemCost(
  item: RecipeItemWithRelations,
  scale: Decimal = new Decimal(1),
  visited: Set<number> = new Set()
): Decimal {
  const quantity = new Decimal(item.quantity.toString()).mul(scale);

  if (item.ingredientId != null && item.ingredient != null) {
    const unitCost = getIngredientUnitCost(item.ingredient, item.unit);
    return quantity.mul(unitCost);
  }

  if (item.subRecipeId != null && item.subRecipe != null) {
    if (visited.has(item.subRecipeId)) {
      throw new RecipeCycleError(
        `Cycle detected: recipe ${item.subRecipeId} is referenced recursively`
      );
    }

    const subRecipe = item.subRecipe;
    const subYield = new Decimal(subRecipe.yieldQty.toString());

    if (subYield.isZero()) {
      throw new CostCalculationError(
        `Sub-recipe ${subRecipe.name} has zero yield`
      );
    }

    const batchCost = calculateRecipeCost(
      subRecipe,
      new Decimal(1),
      new Set([...visited, item.recipeId])
    );

    const batchesNeeded = quantity.div(subYield);
    return batchCost.mul(batchesNeeded);
  }

  throw new CostCalculationError('Recipe item has no ingredient or sub-recipe');
}

/**
 * Calculate the total cost of a recipe.
 */
export function calculateRecipeCost(
  recipe: RecipeWithRelations,
  scale: Decimal = new Decimal(1),
  visited: Set<number> = new Set()
): Decimal {
  if (visited.has(recipe.id)) {
    throw new RecipeCycleError(
      `Cycle detected: recipe ${recipe.id} (${recipe.name}) is referenced recursively`
    );
  }

  const newVisited = new Set([...visited, recipe.id]);
  let totalCost = new Decimal(0);

  for (const item of recipe.items ?? []) {
    const itemCost = calculateRecipeItemCost(item, scale, newVisited);
    totalCost = totalCost.plus(itemCost);
  }

  return totalCost;
}

/**
 * Calculate the cost per portion/serving.
 */
export function calculateCostPerPortion(
  recipe: RecipeWithRelations,
  scale: Decimal = new Decimal(1)
): Decimal {
  const totalCost = calculateRecipeCost(recipe, scale);
  const yieldQty = new Decimal(recipe.yieldQty.toString()).mul(scale);

  if (yieldQty.isZero()) {
    throw new CostCalculationError(`Recipe ${recipe.name} has zero yield`);
  }

  return totalCost.div(yieldQty);
}

/**
 * Calculate the food cost percentage.
 * Formula: (cost per portion / selling price) * 100
 */
export function calculateFoodCostPercentage(
  recipe: RecipeWithRelations,
  sellingPrice?: Decimal | null
): Decimal | null {
  const price = sellingPrice ?? null;

  if (price == null || price.isZero()) {
    return null;
  }

  const costPerPortion = calculateCostPerPortion(recipe);
  return costPerPortion.div(price).mul(100);
}
