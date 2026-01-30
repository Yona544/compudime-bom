import { Decimal } from 'decimal.js';
type DecimalValue = string | number | bigint | InstanceType<typeof Decimal>;

export class UnitConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnitConversionError';
  }
}

type UnitCategory = 'weight' | 'volume' | 'count';

const WEIGHT_UNITS = new Set(['g', 'kg', 'oz', 'lb', 'mg']);
const VOLUME_UNITS = new Set(['ml', 'l', 'tsp', 'tbsp', 'cup', 'fl_oz', 'gal', 'qt', 'pt']);
const COUNT_UNITS = new Set(['each', 'piece', 'dozen']);

const WEIGHT_TO_GRAMS: Record<string, Decimal> = {
  mg: new Decimal('0.001'),
  g: new Decimal('1'),
  kg: new Decimal('1000'),
  oz: new Decimal('28.3495'),
  lb: new Decimal('453.592')
};

const VOLUME_TO_ML: Record<string, Decimal> = {
  ml: new Decimal('1'),
  l: new Decimal('1000'),
  tsp: new Decimal('4.92892'),
  tbsp: new Decimal('14.7868'),
  fl_oz: new Decimal('29.5735'),
  cup: new Decimal('236.588'),
  pt: new Decimal('473.176'),
  qt: new Decimal('946.353'),
  gal: new Decimal('3785.41')
};

const COUNT_TO_EACH: Record<string, Decimal> = {
  each: new Decimal('1'),
  piece: new Decimal('1'),
  dozen: new Decimal('12')
};

const getFactor = (table: Record<string, Decimal>, unit: string): Decimal => {
  const factor = table[unit];
  if (!factor) {
    throw new UnitConversionError(`Unknown unit: ${unit}`);
  }
  return factor;
};

export const normalizeUnit = (unit: string): string => unit.toLowerCase().trim();

export const getUnitCategory = (unit: string): UnitCategory => {
  const normalized = normalizeUnit(unit);
  if (WEIGHT_UNITS.has(normalized)) {
    return 'weight';
  }
  if (VOLUME_UNITS.has(normalized)) {
    return 'volume';
  }
  if (COUNT_UNITS.has(normalized)) {
    return 'count';
  }
  throw new UnitConversionError(`Unknown unit: ${normalized}`);
};

export const convert = (
  value: DecimalValue,
  fromUnit: string,
  toUnit: string,
  density?: DecimalValue | null
): Decimal => {
  const decimalValue = new Decimal(value);
  const normalizedFrom = normalizeUnit(fromUnit);
  const normalizedTo = normalizeUnit(toUnit);

  const fromCategory = getUnitCategory(normalizedFrom);
  const toCategory = getUnitCategory(normalizedTo);

  if (normalizedFrom === normalizedTo) {
    return decimalValue;
  }

  if (fromCategory === toCategory) {
    if (fromCategory === 'weight') {
      const grams = decimalValue.mul(getFactor(WEIGHT_TO_GRAMS, normalizedFrom));
      return grams.div(getFactor(WEIGHT_TO_GRAMS, normalizedTo));
    }

    if (fromCategory === 'volume') {
      const ml = decimalValue.mul(getFactor(VOLUME_TO_ML, normalizedFrom));
      return ml.div(getFactor(VOLUME_TO_ML, normalizedTo));
    }

    const each = decimalValue.mul(getFactor(COUNT_TO_EACH, normalizedFrom));
    return each.div(getFactor(COUNT_TO_EACH, normalizedTo));
  }

  if (density == null) {
    throw new UnitConversionError(
      `Cannot convert ${normalizedFrom} (${fromCategory}) to ${normalizedTo} (${toCategory}) without density`
    );
  }

  const densityValue = new Decimal(density);
  if (densityValue.isZero()) {
    throw new UnitConversionError('Density must be non-zero for weight/volume conversion');
  }

  if (fromCategory === 'weight' && toCategory === 'volume') {
    const grams = decimalValue.mul(getFactor(WEIGHT_TO_GRAMS, normalizedFrom));
    const ml = grams.div(densityValue);
    return ml.div(getFactor(VOLUME_TO_ML, normalizedTo));
  }

  if (fromCategory === 'volume' && toCategory === 'weight') {
    const ml = decimalValue.mul(getFactor(VOLUME_TO_ML, normalizedFrom));
    const grams = ml.mul(densityValue);
    return grams.div(getFactor(WEIGHT_TO_GRAMS, normalizedTo));
  }

  throw new UnitConversionError(`Cannot convert between ${fromCategory} and ${toCategory}`);
};

export const areCompatible = (
  unit1: string,
  unit2: string,
  allowDensity = false
): boolean => {
  try {
    const cat1 = getUnitCategory(unit1);
    const cat2 = getUnitCategory(unit2);

    if (cat1 === cat2) {
      return true;
    }

    if (allowDensity) {
      return new Set([cat1, cat2]).size === 2 &&
        ((cat1 === 'weight' && cat2 === 'volume') || (cat1 === 'volume' && cat2 === 'weight'));
    }

    return false;
  } catch (error) {
    return false;
  }
};
