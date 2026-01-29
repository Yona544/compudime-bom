"""
Unit Converter Tests

TDD tests for unit conversion service.
"""

import pytest
from decimal import Decimal

from api.services.unit_converter import (
    convert,
    get_unit_category,
    are_compatible,
    UnitConversionError,
)


class TestGetUnitCategory:
    """Tests for get_unit_category."""

    def test_weight_units(self):
        """Weight units should return 'weight'."""
        for unit in ["g", "kg", "oz", "lb", "mg"]:
            assert get_unit_category(unit) == "weight"

    def test_volume_units(self):
        """Volume units should return 'volume'."""
        for unit in ["ml", "l", "tsp", "tbsp", "cup", "fl_oz"]:
            assert get_unit_category(unit) == "volume"

    def test_count_units(self):
        """Count units should return 'count'."""
        for unit in ["each", "piece", "dozen"]:
            assert get_unit_category(unit) == "count"

    def test_unknown_unit_raises(self):
        """Unknown units should raise UnitConversionError."""
        with pytest.raises(UnitConversionError):
            get_unit_category("unknown")

    def test_case_insensitive(self):
        """Unit lookup should be case insensitive."""
        assert get_unit_category("KG") == "weight"
        assert get_unit_category("Cup") == "volume"


class TestConvertWeight:
    """Tests for weight conversions."""

    def test_kg_to_g(self):
        """1 kg = 1000 g."""
        result = convert(1, "kg", "g")
        assert result == Decimal("1000")

    def test_lb_to_oz(self):
        """1 lb = 16 oz (approximately)."""
        result = convert(1, "lb", "oz")
        assert abs(result - Decimal("16")) < Decimal("0.01")

    def test_oz_to_g(self):
        """1 oz ≈ 28.35 g."""
        result = convert(1, "oz", "g")
        assert abs(result - Decimal("28.35")) < Decimal("0.01")

    def test_same_unit(self):
        """Converting to same unit should return original value."""
        result = convert(5, "kg", "kg")
        assert result == Decimal("5")


class TestConvertVolume:
    """Tests for volume conversions."""

    def test_l_to_ml(self):
        """1 L = 1000 mL."""
        result = convert(1, "l", "ml")
        assert result == Decimal("1000")

    def test_cup_to_ml(self):
        """1 cup ≈ 236.6 mL."""
        result = convert(1, "cup", "ml")
        assert abs(result - Decimal("236.588")) < Decimal("0.01")

    def test_tbsp_to_tsp(self):
        """1 tbsp = 3 tsp."""
        result = convert(1, "tbsp", "tsp")
        assert abs(result - Decimal("3")) < Decimal("0.01")


class TestConvertCount:
    """Tests for count conversions."""

    def test_dozen_to_each(self):
        """1 dozen = 12 each."""
        result = convert(1, "dozen", "each")
        assert result == Decimal("12")

    def test_each_to_dozen(self):
        """24 each = 2 dozen."""
        result = convert(24, "each", "dozen")
        assert result == Decimal("2")


class TestCrossTypeConversion:
    """Tests for cross-type conversions (requires density)."""

    def test_weight_to_volume_without_density_raises(self):
        """Weight to volume without density should raise error."""
        with pytest.raises(UnitConversionError) as exc_info:
            convert(100, "g", "ml")
        assert "without density" in str(exc_info.value)

    def test_weight_to_volume_with_density(self):
        """Weight to volume with density should work."""
        # Water: density = 1 g/ml
        result = convert(100, "g", "ml", density=1)
        assert result == Decimal("100")

    def test_volume_to_weight_with_density(self):
        """Volume to weight with density should work."""
        # Flour: density ≈ 0.593 g/ml
        # 236.588 ml (1 cup) * 0.593 g/ml ≈ 140.3 g
        result = convert(1, "cup", "g", density=Decimal("0.593"))
        assert abs(result - Decimal("140.3")) < Decimal("1")

    def test_incompatible_types_raise(self):
        """Incompatible types (count vs weight) should raise error."""
        with pytest.raises(UnitConversionError):
            convert(1, "each", "g")


class TestAreCompatible:
    """Tests for are_compatible."""

    def test_same_category_compatible(self):
        """Same category units are compatible."""
        assert are_compatible("kg", "lb") is True
        assert are_compatible("cup", "ml") is True

    def test_different_category_not_compatible(self):
        """Different category units are not compatible by default."""
        assert are_compatible("kg", "ml") is False

    def test_different_category_compatible_with_density(self):
        """Weight and volume are compatible when allow_density=True."""
        assert are_compatible("kg", "ml", allow_density=True) is True
        assert are_compatible("each", "kg", allow_density=True) is False
