"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { ApiError } from "@/lib/api/client";
import * as mealsApi from "@/lib/api/meals";
import type { MealView } from "@/lib/api/meals";
import * as pantryApi from "@/lib/api/pantry";
import type { PantryItemView } from "@/lib/api/parse";
import { formatQty, unitsForBase } from "@/lib/units";
import type { MealItemSource, MeasurementUnit } from "@/lib/types/api";
import { playAlertSound } from "@/lib/playAlertSound";
import { MealNutritionDetails } from "@/components/meals/MealNutritionDetails";
import { Icon } from "@/components/ui/Icons";

type DraftItem = {
  pantryItemId: string;
  label: string;
  quantityUsed: string;
  unit: MeasurementUnit;
  source: MealItemSource;
};

function MealsPageInner() {
  const [meals, setMeals] = useState<MealView[]>([]);
  const [pantry, setPantry] = useState<PantryItemView[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);

  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState<DraftItem>({
    pantryItemId: "",
    label: "",
    quantityUsed: "",
    unit: "g",
    source: "manual",
  });
  const [queued, setQueued] = useState<DraftItem[]>([]);

  const refresh = useCallback(async () => {
    const [mealList, pantryList] = await Promise.all([
      mealsApi.listMeals(),
      pantryApi.listPantryItems(),
    ]);
    setMeals(mealList);
    setPantry(pantryList);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load meals");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  function onPantryPick(id: string) {
    if (id === "__bought__") {
      setQueued([]);
      setDraft((prev) => ({
        ...prev,
        pantryItemId: "",
        label: "",
        quantityUsed: "",
        unit: "g",
        source: "bought",
      }));
      return;
    }

    const item = pantry.find((p) => p.id === id);
    setDraft((prev) => ({
      ...prev,
      pantryItemId: id,
      label: item ? item.productName : prev.label,
      unit: item ? item.baseUnit : prev.unit,
      source: item ? "pantry" : "manual",
    }));
  }

  function addToQueue() {
    setError(null);
    if (!draft.label.trim() || !draft.quantityUsed) {
      setError("Each meal item needs a label and quantity");
      return;
    }
    setQueued((prev) => [...prev, { ...draft, label: draft.label.trim() }]);
    setDraft({
      pantryItemId: "",
      label: "",
      quantityUsed: "",
      unit: "g",
      source: "manual",
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);

    const items =
      queued.length > 0
        ? queued
        : draft.label.trim() && draft.quantityUsed
          ? [draft]
          : [];

    if (items.length === 0) {
      setError("Add at least one food and confirm the amount eaten");
      return;
    }

    setSubmitting(true);
    try {
      const result = await mealsApi.logMeal({
        notes: notes.trim() || undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        items: items.map((item) => ({
          pantryItemId: item.pantryItemId || null,
          label: item.label.trim(),
          quantityUsed: Number(item.quantityUsed),
          unit: item.unit,
          source: item.source,
        })),
      });
      if (result.alertsCreated > 0) playAlertSound();
      setNotes("");
      setQueued([]);
      setDraft({
        pantryItemId: "",
        label: "",
        quantityUsed: "",
        unit: "g",
        source: "manual",
      });
      setStatus("Meal logged");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not log meal");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedPantry = pantry.find((p) => p.id === draft.pantryItemId);
  const unitOptions = selectedPantry
    ? unitsForBase(selectedPantry.baseUnit)
    : (["g", "ml", "tsp", "tbsp", "cup"] as MeasurementUnit[]);

  return (
    <>
      <div className="mb-8">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-sage">Daily rhythm</p>
        <h1 className="font-display text-4xl font-semibold tracking-[-0.04em] text-ink sm:text-5xl">Meal journal</h1>
        <p className="mt-2 text-sm text-ink/55">
          Log what you ate — pantry-linked items get deducted automatically
        </p>
      </div>

      {status && (
        <p className="mb-3 rounded-lg bg-sage/10 px-3 py-2 text-sm text-sage">{status}</p>
      )}
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-brick/10 px-3 py-2 text-sm text-brick">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="app-surface mb-8 flex flex-col gap-4 rounded-[24px] p-5 sm:p-6"
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">Item source</label>
          <select
            className="rounded-lg border border-border-warm bg-white px-3.5 py-2.5 text-base"
            value={draft.source === "bought" ? "__bought__" : draft.pantryItemId}
            onChange={(e) => onPantryPick(e.target.value)}
          >
            <option value="">Manual entry — no deduction</option>
            <option value="__bought__">Bought outside — no pantry deduction</option>
            {pantry.map((item) => (
              <option key={item.id} value={item.id}>
                {item.productName} ({formatQty(item.remainingQuantity, item.baseUnit)} left)
              </option>
            ))}
          </select>
        </div>

        <TextField
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Lunch"
        />

        <TextField
          label={draft.source === "bought" ? "Food name" : "Label"}
          required={queued.length === 0}
          value={draft.label}
          onChange={(e) => setDraft((prev) => ({ ...prev, label: e.target.value }))}
          placeholder={draft.source === "bought" ? "Nasi padang" : "Chicken breast"}
        />

        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={draft.source === "bought" ? "Amount eaten" : "Quantity used"}
            type="number"
            min={0.01}
            step="any"
            required={queued.length === 0}
            value={draft.quantityUsed}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, quantityUsed: e.target.value }))
            }
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink/80">
              {draft.source === "bought" ? "Confirmed unit" : "Unit"}
            </label>
            <select
              className="rounded-lg border border-border-warm bg-white px-3.5 py-2.5 text-base"
              value={draft.unit}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  unit: e.target.value as MeasurementUnit,
                }))
              }
            >
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        {queued.length > 0 && (
          <ul className="rounded-xl border border-border-warm bg-paper/80 p-3 text-sm">
            {queued.map((item, idx) => (
              <li key={`${item.label}-${idx}`} className="flex justify-between gap-2 py-1">
                <span>
                  {item.label} · {item.quantityUsed}
                  {item.unit}
                  {item.source === "pantry" ? " (from pantry)" : " (manual)"}
                </span>
                <button
                  type="button"
                  className="text-brick hover:underline"
                  onClick={() => setQueued((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-2">
          {draft.source !== "bought" && (
            <Button type="button" variant="secondary" onClick={addToQueue}>
              Add another item
            </Button>
          )}
          <Button type="submit" loading={submitting}>
            Log meal
          </Button>
        </div>
      </form>

      <h2 className="mb-3 text-lg font-semibold text-ink">Recent meals</h2>
      {loading ? (
        <p className="text-sm text-ink/55">Loading…</p>
      ) : meals.length === 0 ? (
        <p className="text-sm text-ink/55">No meals logged yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {meals.map((meal) => (
            <li key={meal.id} className="app-surface overflow-hidden rounded-[22px]">
              <button
                type="button"
                className="flex w-full items-start justify-between gap-4 p-5 text-left outline-none transition hover:bg-sage/[0.04] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sage/40 sm:p-6"
                aria-expanded={expandedMealId === meal.id}
                aria-controls={`meal-nutrition-${meal.id}`}
                onClick={() =>
                  setExpandedMealId((current) => current === meal.id ? null : meal.id)
                }
              >
                <span className="min-w-0">
                  <span className="block font-medium text-ink">
                    {new Date(meal.loggedAt).toLocaleString()}
                  </span>
                  <span className="mt-0.5 block text-sm text-ink/60">
                    {meal.notes || "No notes"}
                  </span>
                  <span className="mt-2 block space-y-1 text-sm text-ink/80">
                    {meal.items.map((item) => (
                      <span key={item.id} className="block">
                        {item.label} — {formatQty(item.quantityUsed, item.unit)}
                        {item.source === "pantry"
                          ? ""
                          : item.source === "bought"
                            ? " (bought)"
                            : " (manual)"}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {meal.nutrition.matchedItems.length > 0 && (
                    <span className="hidden text-sm font-semibold text-ink/60 sm:block">
                      {Math.round(meal.nutrition.totals.caloriesKcal).toLocaleString()} kcal
                    </span>
                  )}
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-border-warm bg-white text-ink/55">
                    <Icon
                      name="chevron"
                      className={`h-4 w-4 transition-transform ${
                        expandedMealId === meal.id ? "rotate-180" : ""
                      }`}
                    />
                  </span>
                </span>
              </button>
              {expandedMealId === meal.id && (
                <div id={`meal-nutrition-${meal.id}`}>
                  <MealNutritionDetails nutrition={meal.nutrition} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function MealsPage() {
  return (
    <AppShell>
      <MealsPageInner />
    </AppShell>
  );
}
