import type { MealNutrition } from "@/lib/types/api";

const MACRO_COLORS = {
  carbohydrate: "#2f8795",
  protein: "#c84f3a",
  fat: "#d59a2e",
  fiber: "#667f4f",
} as const;

function formatGrams(value: number) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} g`;
}

function energyPercentage(energy: number, totalEnergy: number) {
  return totalEnergy > 0 ? Math.round((energy / totalEnergy) * 1000) / 10 : 0;
}

export function MealNutritionDetails({ nutrition }: { nutrition: MealNutrition }) {
  const { totals } = nutrition;
  const availableCarbohydrate = Math.max(totals.carbohydrateG - totals.fiberG, 0);
  const macroRows = [
    {
      key: "carbohydrate",
      label: "Carbohydrates",
      grams: totals.carbohydrateG,
      energy: availableCarbohydrate * 4,
      color: MACRO_COLORS.carbohydrate,
    },
    {
      key: "protein",
      label: "Protein",
      grams: totals.proteinG,
      energy: totals.proteinG * 4,
      color: MACRO_COLORS.protein,
    },
    {
      key: "fat",
      label: "Fat",
      grams: totals.fatG,
      energy: totals.fatG * 9,
      color: MACRO_COLORS.fat,
    },
    {
      key: "fiber",
      label: "Fiber",
      grams: totals.fiberG,
      energy: totals.fiberG * 2,
      color: MACRO_COLORS.fiber,
    },
  ];
  const totalMacroEnergy = macroRows.reduce((sum, macro) => sum + macro.energy, 0);
  let chartCursor = 0;
  const chartStops = macroRows.map((macro) => {
    const start = chartCursor;
    const percentage = totalMacroEnergy > 0 ? (macro.energy / totalMacroEnergy) * 100 : 0;
    chartCursor += percentage;
    return `${macro.color} ${start}% ${chartCursor}%`;
  });
  const chartBackground = totalMacroEnergy > 0
    ? `conic-gradient(${chartStops.join(", ")})`
    : "#e8e9e2";
  const ariaSummary = macroRows
    .map((macro) => {
      const percentage = energyPercentage(macro.energy, totalMacroEnergy);
      return `${macro.label} ${percentage} percent, ${formatGrams(macro.grams)}`;
    })
    .join("; ");

  return (
    <div className="border-t border-border-warm px-5 pb-5 pt-6 sm:px-6">
      {nutrition.matchedItems.length === 0 ? (
        <div>
          <p className="font-semibold text-ink">Nutrition estimate unavailable</p>
          <p className="mt-1 text-sm leading-6 text-ink/55">
            None of this meal&apos;s items match a mass-based food-composition record.
          </p>
        </div>
      ) : (
        <div className="grid items-center gap-7 lg:grid-cols-[220px_1fr]">
          <div className="flex justify-center lg:justify-start">
            <div
              className="relative aspect-square w-48 shrink-0 rounded-full"
              style={{ background: chartBackground }}
              role="img"
              aria-label={`Estimated macro energy distribution: ${ariaSummary}`}
            >
              <div className="absolute inset-[24%] grid place-items-center rounded-full bg-white text-center shadow-[0_0_0_1px_rgba(33,48,39,0.06)]">
                <div>
                  <p className="text-2xl font-bold text-ink">
                    {Math.round(totals.caloriesKcal).toLocaleString()}
                  </p>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink/45">
                    kcal
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sage">
                  Estimated nutrition
                </p>
                <h3 className="mt-1 font-display text-2xl font-semibold text-ink">Macro balance</h3>
              </div>
              <p className="text-sm font-medium text-ink/55">
                {nutrition.matchedItems.length} of{" "}
                {nutrition.matchedItems.length + nutrition.unmatchedItems.length} items matched
              </p>
            </div>

            <dl className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {macroRows.map((macro) => {
                const percentage = energyPercentage(macro.energy, totalMacroEnergy);
                return (
                  <div
                    key={macro.key}
                    className="flex items-center justify-between border-b border-border-warm/70 pb-3"
                  >
                    <dt className="flex min-w-0 items-center gap-2.5 text-sm font-medium text-ink/70">
                      <span
                        className="h-3 w-3 shrink-0 rounded-sm"
                        style={{ backgroundColor: macro.color }}
                        aria-hidden="true"
                      />
                      {macro.label}
                    </dt>
                    <dd className="ml-3 text-right">
                      <span className="font-semibold text-ink">{formatGrams(macro.grams)}</span>
                      <span className="ml-2 text-xs font-semibold text-ink/45">{percentage}%</span>
                    </dd>
                  </div>
                );
              })}
            </dl>

            <p className="mt-4 text-xs leading-5 text-ink/45">
              Percentages estimate energy contribution. Total carbohydrate grams include fiber.
              Values use generic {nutrition.source} records and the logged ingredient weights.
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 border-t border-border-warm/70 pt-4 text-xs leading-5 text-ink/50">
        {nutrition.matchedItems.map((item) => (
          <p key={item.itemId}>
            {item.label}: {formatGrams(item.quantityGrams)} matched to {item.foodName} ({
              item.foodState.replaceAll("_", " ")
            })
          </p>
        ))}
        {nutrition.unmatchedItems.map((item) => (
          <p key={item.itemId} className="text-brick">
            {item.label}: {item.reason}
          </p>
        ))}
      </div>
    </div>
  );
}
