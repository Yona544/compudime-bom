"""
Unit Conversion Service

Handles conversion between different units of measurement.
"""

from decimal import Decimal
from typing import Optional


class UnitConversionError(Exception):
    """Raised when unit conversion is not possible."""
    pass


# Unit categories
WEIGHT_UNITS = {"g", "kg", "oz", "lb", "mg"}
VOLUME_UNITS = {"ml", "l", "tsp", "tbsp", "cup", "fl_oz", "gal", "qt", "pt"}
COUNT_UNITS = {"each", "piece", "dozen"}

# Conversions to base unit (grams for weight, ml for volume)
WEIGHT_TO_GRAMS = {
    "mg": Decimal("0.001"),
    "g": Decimal("1"),
    "kg": Decimal("1000"),
    "oz": Decimal("28.3495"),
    "lb": Decimal("453.592"),
}

VOLUME_TO_ML = {
    "ml": Decimal("1"),
    "l": Decimal("1000"),
    "tsp": Decimal("4.92892"),
    "tbsp": Decimal("14.7868"),
    "fl_oz": Decimal("29.5735"),
    "cup": Decimal("236.588"),
    "pt": Decimal("473.176"),
    "qt": Decimal("946.353"),
    "gal": Decimal("3785.41"),
}

COUNT_TO_EACH = {
    "each": Decimal("1"),
    "piece": Decimal("1"),
    "dozen": Decimal("12"),
}


def get_unit_category(unit: str) -> str:
    """Get the category of a unit."""
    unit = unit.lower().strip()
    if unit in WEIGHT_UNITS:
        return "weight"
    elif unit in VOLUME_UNITS:
        return "volume"
    elif unit in COUNT_UNITS:
        return "count"
    else:
        raise UnitConversionError(f"Unknown unit: {unit}")


def convert(
    value: Decimal | float | int,
    from_unit: str,
    to_unit: str,
    density: Optional[Decimal | float] = None,
) -> Decimal:
    """
    Convert a value from one unit to another.
    
    Args:
        value: The value to convert
        from_unit: Source unit
        to_unit: Target unit
        density: Density in g/ml (required for weight↔volume conversion)
    
    Returns:
        Converted value
    
    Raises:
        UnitConversionError: If conversion is not possible
    """
    value = Decimal(str(value))
    from_unit = from_unit.lower().strip()
    to_unit = to_unit.lower().strip()
    
    if from_unit == to_unit:
        return value
    
    from_category = get_unit_category(from_unit)
    to_category = get_unit_category(to_unit)
    
    # Same category conversion
    if from_category == to_category:
        if from_category == "weight":
            # Convert to grams, then to target
            grams = value * WEIGHT_TO_GRAMS[from_unit]
            return grams / WEIGHT_TO_GRAMS[to_unit]
        elif from_category == "volume":
            # Convert to ml, then to target
            ml = value * VOLUME_TO_ML[from_unit]
            return ml / VOLUME_TO_ML[to_unit]
        elif from_category == "count":
            each = value * COUNT_TO_EACH[from_unit]
            return each / COUNT_TO_EACH[to_unit]
    
    # Cross-category conversion (requires density)
    if density is None:
        raise UnitConversionError(
            f"Cannot convert {from_unit} ({from_category}) to {to_unit} ({to_category}) "
            "without density"
        )
    
    density = Decimal(str(density))
    
    if from_category == "weight" and to_category == "volume":
        # weight → grams → ml → target volume
        grams = value * WEIGHT_TO_GRAMS[from_unit]
        ml = grams / density  # density = g/ml, so g / (g/ml) = ml
        return ml / VOLUME_TO_ML[to_unit]
    
    elif from_category == "volume" and to_category == "weight":
        # volume → ml → grams → target weight
        ml = value * VOLUME_TO_ML[from_unit]
        grams = ml * density
        return grams / WEIGHT_TO_GRAMS[to_unit]
    
    raise UnitConversionError(
        f"Cannot convert between {from_category} and {to_category}"
    )


def normalize_unit(unit: str) -> str:
    """Normalize unit string to lowercase without extra whitespace."""
    return unit.lower().strip()


def are_compatible(unit1: str, unit2: str, allow_density: bool = False) -> bool:
    """
    Check if two units are compatible for conversion.
    
    Args:
        unit1: First unit
        unit2: Second unit
        allow_density: If True, weight↔volume is considered compatible
    """
    try:
        cat1 = get_unit_category(unit1)
        cat2 = get_unit_category(unit2)
        
        if cat1 == cat2:
            return True
        
        if allow_density:
            # Weight and volume can convert with density
            return {cat1, cat2} == {"weight", "volume"}
        
        return False
    except UnitConversionError:
        return False
