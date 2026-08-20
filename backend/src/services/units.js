// Converts incoming quantities to the pantry's base unit (g or ml)
// before any write. This is the ONE place unit math happens -- every
// other file assumes quantities are already normalized.
//
// Approximations are fine for a hackathon; these are rough kitchen
// conversions, not lab-grade. Density assumptions (e.g. tsp of sugar
// vs tsp of oil) are deliberately ignored -- flag as a known
// simplification if a judge asks.

const TO_ML = {
  ml: 1,
  l: 1000,
  tsp: 4.93,
  tbsp: 14.79,
  cup: 236.59,
  fl_oz: 29.57,
};

const TO_G = {
  g: 1,
  kg: 1000,
  oz: 28.35,
  lb: 453.59,
  pinch: 0.36, // rough approximation, ~1/16 tsp of a dry ingredient
};

/**
 * @param {number} amount
 * @param {string} fromUnit - one of the units in TO_ML or TO_G
 * @param {'g'|'ml'} targetBaseUnit - the pantry item's base_unit
 * @returns {number} amount converted to targetBaseUnit
 * @throws if fromUnit can't convert into targetBaseUnit. This is
 *   intentional, not a missing conversion factor: volume units
 *   (tsp/tbsp/cup/fl_oz/ml/l) can't become grams without knowing the
 *   ingredient's density, and this module has no density table.
 *   A tsp of sugar and a tsp of oil are not the same number of grams.
 *   If Person 1's meal-logging form needs to accept tsp/tbsp for a
 *   g-based item (salt, sugar, pepper), the fix is deciding a specific
 *   density for that product -- not adding it here as if all
 *   ingredients weigh the same per teaspoon.
 */
export function toBaseUnit(amount, fromUnit, targetBaseUnit) {
  if (targetBaseUnit === 'ml') {
    if (!(fromUnit in TO_ML)) {
      throw new Error(
        `"${fromUnit}" is a mass unit and can't convert to ml (volume) without a density`
      );
    }
    return amount * TO_ML[fromUnit];
  }

  if (targetBaseUnit === 'g') {
    if (!(fromUnit in TO_G)) {
      throw new Error(
        `"${fromUnit}" is a volume unit and can't convert to g (mass) without a density`
      );
    }
    return amount * TO_G[fromUnit];
  }

  throw new Error(`Unknown base unit "${targetBaseUnit}"`);
}
