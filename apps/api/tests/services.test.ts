import { describe, expect, it } from '@jest/globals';
import { Decimal } from 'decimal.js';
import {
  convert,
  normalizeUnit,
  getUnitCategory,
  areCompatible,
  UnitConversionError
} from '../src/services/unit-converter.js';
import {
  getIngredientUnitCost,
  calculateRecipeCost,
  CostCalculationError
} from '../src/services/cost-calculator.js';

describe('unit-converter', () => {
  describe('normalizeUnit', () => {
    it('lowercases and trims units', () => {
      expect(normalizeUnit('  OZ  ')).toBe('oz');
      expect(normalizeUnit('LB')).toBe('lb');
    });
  });

  describe('getUnitCategory', () => {
    it('identifies weight units', () => {
      expect(getUnitCategory('g')).toBe('weight');
      expect(getUnitCategory('kg')).toBe('weight');
      expect(getUnitCategory('oz')).toBe('weight');
      expect(getUnitCategory('lb')).toBe('weight');
    });

    it('identifies volume units', () => {
      expect(getUnitCategory('ml')).toBe('volume');
      expect(getUnitCategory('l')).toBe('volume');
      expect(getUnitCategory('cup')).toBe('volume');
      expect(getUnitCategory('tbsp')).toBe('volume');
    });

    it('identifies count units', () => {
      expect(getUnitCategory('each')).toBe('count');
      expect(getUnitCategory('piece')).toBe('count');
      expect(getUnitCategory('dozen')).toBe('count');
    });

    it('throws for unknown units', () => {
      expect(() => getUnitCategory('unknown')).toThrow(UnitConversionError);
    });
  });

  describe('convert', () => {
    it('returns same value for same unit', () => {
      const result = convert(100, 'g', 'g');
      expect(result.toNumber()).toBe(100);
    });

    it('converts weight units', () => {
      // 1 lb = 453.592 g
      const result = convert(1, 'lb', 'g');
      expect(result.toNumber()).toBeCloseTo(453.592, 2);
    });

    it('converts volume units', () => {
      // 1 cup = 236.588 ml
      const result = convert(1, 'cup', 'ml');
      expect(result.toNumber()).toBeCloseTo(236.588, 2);
    });

    it('converts count units', () => {
      // 1 dozen = 12 each
      const result = convert(1, 'dozen', 'each');
      expect(result.toNumber()).toBe(12);
    });

    it('throws when converting between incompatible categories without density', () => {
      expect(() => convert(100, 'g', 'ml')).toThrow(UnitConversionError);
    });

    it('converts weight to volume with density', () => {
      // 100g of water (density 1 g/ml) = 100ml
      const result = convert(100, 'g', 'ml', 1);
      expect(result.toNumber()).toBeCloseTo(100, 2);
    });

    it('converts volume to weight with density', () => {
      // 100ml of water (density 1 g/ml) = 100g
      const result = convert(100, 'ml', 'g', 1);
      expect(result.toNumber()).toBeCloseTo(100, 2);
    });
  });

  describe('areCompatible', () => {
    it('returns true for same category', () => {
      expect(areCompatible('g', 'oz')).toBe(true);
      expect(areCompatible('ml', 'cup')).toBe(true);
    });

    it('returns false for different categories without density', () => {
      expect(areCompatible('g', 'ml')).toBe(false);
    });

    it('returns true for weight/volume when density is allowed', () => {
      expect(areCompatible('g', 'ml', true)).toBe(true);
    });
  });
});

describe('cost-calculator', () => {
  describe('getIngredientUnitCost', () => {
    it('calculates cost per recipe unit', () => {
      // $10 for 5 lb, 16 oz per lb, 100% yield
      // Cost per oz = $10 / 5 / 16 = $0.125
      const ingredient = {
        id: 1,
        userId: 'test',
        name: 'Chicken',
        description: null,
        purchaseUnit: 'lb',
        purchaseQty: new Decimal(5),
        purchasePrice: new Decimal(10),
        recipeUnit: 'oz',
        conversionFactor: new Decimal(16),
        yieldPercent: new Decimal(100),
        minStockLevel: null,
        currentStock: null,
        supplierId: null,
        storageAreaId: null,
        allergens: null,
        nutrition: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const cost = getIngredientUnitCost(ingredient);
      expect(cost.toNumber()).toBeCloseTo(0.125, 3);
    });

    it('applies yield percentage', () => {
      // $10 for 5 lb, 16 oz per lb, 80% yield
      // Cost per oz = $10 / 5 / 16 / 0.8 = $0.15625
      const ingredient = {
        id: 1,
        userId: 'test',
        name: 'Chicken',
        description: null,
        purchaseUnit: 'lb',
        purchaseQty: new Decimal(5),
        purchasePrice: new Decimal(10),
        recipeUnit: 'oz',
        conversionFactor: new Decimal(16),
        yieldPercent: new Decimal(80),
        minStockLevel: null,
        currentStock: null,
        supplierId: null,
        storageAreaId: null,
        allergens: null,
        nutrition: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const cost = getIngredientUnitCost(ingredient);
      expect(cost.toNumber()).toBeCloseTo(0.15625, 4);
    });

    it('throws for zero purchase quantity', () => {
      const ingredient = {
        id: 1,
        userId: 'test',
        name: 'Test',
        description: null,
        purchaseUnit: 'lb',
        purchaseQty: new Decimal(0),
        purchasePrice: new Decimal(10),
        recipeUnit: 'oz',
        conversionFactor: new Decimal(16),
        yieldPercent: new Decimal(100),
        minStockLevel: null,
        currentStock: null,
        supplierId: null,
        storageAreaId: null,
        allergens: null,
        nutrition: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(() => getIngredientUnitCost(ingredient)).toThrow(CostCalculationError);
    });
  });

  describe('calculateRecipeCost', () => {
    it('calculates cost for empty recipe', () => {
      const recipe = {
        id: 1,
        userId: 'test',
        name: 'Empty Recipe',
        description: null,
        yieldQty: new Decimal(4),
        yieldUnit: 'servings',
        prepTime: null,
        cookTime: null,
        sellingPrice: null,
        targetCostPct: null,
        instructions: null,
        notes: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: []
      };

      const cost = calculateRecipeCost(recipe);
      expect(cost.toNumber()).toBe(0);
    });
  });
});
