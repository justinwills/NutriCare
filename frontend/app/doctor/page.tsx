"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { ApiError } from "@/lib/api/client";
import * as doctorApi from "@/lib/api/doctor";
import type {
  DietaryLimitType,
  DietaryLimitUnit,
  DoctorPatientLink,
  FoodRecommendation,
  RecommendationPriority,
  RecommendationType,
  SupervisionPlan,
} from "@/lib/types/api";

const CONDITION_OPTIONS = [
  "Hypertension",
  "Diabetes",
  "Kidney disease",
  "Heart disease",
  "High cholesterol",
  "Obesity",
  "Food allergy",
];
const SELECT_CLASS =
  "min-h-12 rounded-xl border border-border-warm bg-white/85 px-3.5 py-2.5 text-base text-ink outline-none focus:border-sage/55 focus:ring-4 focus:ring-sage/10";

interface LimitDraft {
  limitType: DietaryLimitType;
  name: string;
  maximumAmount: string;
  unit: DietaryLimitUnit;
  explanation: string;
  enabled: boolean;
}

interface RecommendationDraft {
  recommendationType: RecommendationType;
  foodName: string;
  doctorReason: string;
  priority: RecommendationPriority;
  recommendedFrequency: string;
}

const EMPTY_LIMIT: LimitDraft = {
  limitType: "nutrient",
  name: "sodium",
  maximumAmount: "",
  unit: "mg",
  explanation: "",
  enabled: true,
};

const EMPTY_RECOMMENDATION: RecommendationDraft = {
  recommendationType: "avoid",
  foodName: "",
  doctorReason: "",
  priority: "medium",
  recommendedFrequency: "",
};

function formatNumber(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function DoctorPageInner() {
  const [patients, setPatients] = useState<DoctorPatientLink[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [plan, setPlan] = useState<SupervisionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [linkPatientId, setLinkPatientId] = useState("");
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [customConditions, setCustomConditions] = useState("");
  const [limitDraft, setLimitDraft] = useState<LimitDraft>(EMPTY_LIMIT);
  const [editingLimitId, setEditingLimitId] = useState<string | null>(null);
  const [recommendationDraft, setRecommendationDraft] =
    useState<RecommendationDraft>(EMPTY_RECOMMENDATION);
  const [editingRecommendationId, setEditingRecommendationId] = useState<string | null>(null);

  const loadPatients = useCallback(async () => {
    const list = await doctorApi.listMyPatients();
    setPatients(list);
    setSelectedPatientId((current) =>
      list.some((patient) => patient.id === current) ? current : list[0]?.id || ""
    );
  }, []);

  const loadPlan = useCallback(async (patientId: string) => {
    if (!patientId) {
      setPlan(null);
      return;
    }
    setPlanLoading(true);
    try {
      const nextPlan = await doctorApi.getPatientPlan(patientId);
      setPlan(nextPlan);
      const standard = nextPlan.conditions
        .map((condition) => condition.condition_name)
        .filter((name) => CONDITION_OPTIONS.includes(name));
      const custom = nextPlan.conditions
        .map((condition) => condition.condition_name)
        .filter((name) => !CONDITION_OPTIONS.includes(name));
      setSelectedConditions(standard);
      setCustomConditions(custom.join(", "));
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not load patient plan");
    } finally {
      setPlanLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadPatients();
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : "Could not load linked patients");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPatients]);

  useEffect(() => {
    // Selection changes intentionally trigger a remote plan load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPlan(selectedPatientId);
  }, [loadPlan, selectedPatientId]);

  function beginAction(key: string) {
    setBusy(key);
    setError(null);
    setStatus(null);
  }

  function failAction(caught: unknown, fallback: string) {
    setError(caught instanceof ApiError ? caught.message : fallback);
    setBusy(null);
  }

  async function handleLink(event: FormEvent) {
    event.preventDefault();
    beginAction("link");
    try {
      const patientId = linkPatientId.trim();
      await doctorApi.linkPatient(patientId);
      await loadPatients();
      setSelectedPatientId(patientId);
      setLinkPatientId("");
      setStatus("Hospital patient linked");
      setBusy(null);
    } catch (caught) {
      failAction(caught, "Could not link patient");
    }
  }

  async function handleConditions(event: FormEvent) {
    event.preventDefault();
    if (!selectedPatientId) return;
    beginAction("conditions");
    const custom = customConditions
      .split(/[,;\n]/)
      .map((value) => value.trim())
      .filter(Boolean);
    try {
      await doctorApi.savePatientConditions(selectedPatientId, [
        ...selectedConditions,
        ...custom,
      ]);
      await loadPlan(selectedPatientId);
      setStatus("Medical conditions saved");
      setBusy(null);
    } catch (caught) {
      failAction(caught, "Could not save conditions");
    }
  }

  async function handleLimit(event: FormEvent) {
    event.preventDefault();
    if (!selectedPatientId) return;
    const maximumAmount = Number(limitDraft.maximumAmount);
    if (!Number.isFinite(maximumAmount) || maximumAmount <= 0) {
      setError("Maximum daily amount must be a positive number");
      return;
    }
    beginAction("limit");
    const input = {
      ...limitDraft,
      name: limitDraft.name.trim(),
      maximumAmount,
      explanation: limitDraft.explanation.trim() || undefined,
    };
    try {
      if (editingLimitId) {
        await doctorApi.updateDietaryLimit(selectedPatientId, editingLimitId, input);
      } else {
        await doctorApi.createDietaryLimit(selectedPatientId, input);
      }
      setLimitDraft(EMPTY_LIMIT);
      setEditingLimitId(null);
      await loadPlan(selectedPatientId);
      setStatus("Daily limit saved");
      setBusy(null);
    } catch (caught) {
      failAction(caught, "Could not save daily limit");
    }
  }

  async function toggleLimit(limitId: string, enabled: boolean) {
    if (!selectedPatientId) return;
    beginAction(`limit-${limitId}`);
    try {
      await doctorApi.updateDietaryLimit(selectedPatientId, limitId, { enabled });
      await loadPlan(selectedPatientId);
      setStatus(enabled ? "Limit enabled" : "Limit disabled");
      setBusy(null);
    } catch (caught) {
      failAction(caught, "Could not update limit");
    }
  }

  async function deleteLimit(limitId: string) {
    if (!selectedPatientId) return;
    beginAction(`limit-${limitId}`);
    try {
      await doctorApi.deleteDietaryLimit(selectedPatientId, limitId);
      await loadPlan(selectedPatientId);
      setStatus("Daily limit removed");
      setBusy(null);
    } catch (caught) {
      failAction(caught, "Could not remove limit");
    }
  }

  function editLimit(limit: SupervisionPlan["limits"][number]) {
    setEditingLimitId(limit.id);
    setLimitDraft({
      limitType: limit.limit_type,
      name: limit.name,
      maximumAmount: String(limit.maximum_amount),
      unit: limit.unit,
      explanation: limit.explanation || "",
      enabled: limit.enabled,
    });
  }

  async function handleRecommendation(event: FormEvent) {
    event.preventDefault();
    if (!selectedPatientId) return;
    beginAction("recommendation");
    const input = {
      ...recommendationDraft,
      foodName: recommendationDraft.foodName.trim(),
      doctorReason: recommendationDraft.doctorReason.trim(),
      recommendedFrequency: recommendationDraft.recommendedFrequency.trim() || undefined,
    };
    try {
      if (editingRecommendationId) {
        await doctorApi.updateFoodRecommendation(
          selectedPatientId,
          editingRecommendationId,
          input
        );
      } else {
        await doctorApi.createFoodRecommendation(selectedPatientId, input);
      }
      setRecommendationDraft(EMPTY_RECOMMENDATION);
      setEditingRecommendationId(null);
      await loadPlan(selectedPatientId);
      setStatus("Food guidance saved and shared with the patient");
      setBusy(null);
    } catch (caught) {
      failAction(caught, "Could not save food guidance");
    }
  }

  async function deleteRecommendation(recommendationId: string) {
    if (!selectedPatientId) return;
    beginAction(`recommendation-${recommendationId}`);
    try {
      await doctorApi.deleteFoodRecommendation(selectedPatientId, recommendationId);
      await loadPlan(selectedPatientId);
      setStatus("Food guidance removed");
      setBusy(null);
    } catch (caught) {
      failAction(caught, "Could not remove food guidance");
    }
  }

  function editRecommendation(recommendation: FoodRecommendation) {
    setEditingRecommendationId(recommendation.id);
    setRecommendationDraft({
      recommendationType: recommendation.recommendation_type,
      foodName: recommendation.food_name,
      doctorReason: recommendation.doctor_reason,
      priority: recommendation.priority,
      recommendedFrequency: recommendation.recommended_frequency || "",
    });
  }

  return (
    <>
      <div className="mb-8">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-sage">
          Clinical workspace
        </p>
        <h1 className="font-display text-4xl font-semibold text-ink sm:text-5xl">Patient care</h1>
        <p className="mt-2 text-sm text-ink/55">Doctor-entered nutrition supervision plans</p>
      </div>

      {status && <p className="mb-3 rounded-lg bg-sage/10 px-3 py-2 text-sm text-sage">{status}</p>}
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-brick/10 px-3 py-2 text-sm text-brick">
          {error}
        </p>
      )}

      <section className="app-surface mb-5 rounded-[24px] p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-ink">Linked hospital patient</h2>
        {loading ? (
          <p className="mt-3 text-sm text-ink/50">Loading linked patients...</p>
        ) : patients.length > 0 ? (
          <label className="mt-4 flex flex-col gap-2 text-sm font-semibold text-ink/70">
            Selected patient
            <select
              className={SELECT_CLASS}
              value={selectedPatientId}
              onChange={(event) => setSelectedPatientId(event.target.value)}
            >
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.full_name} ({patient.email})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="mt-3 text-sm text-ink/50">No active patient links.</p>
        )}

        <form onSubmit={handleLink} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <TextField
              label="Hospital patient user ID"
              required
              value={linkPatientId}
              onChange={(event) => setLinkPatientId(event.target.value)}
              placeholder="Patient UUID"
            />
          </div>
          <Button type="submit" loading={busy === "link"}>Link patient</Button>
        </form>
      </section>

      {!selectedPatientId ? null : planLoading && !plan ? (
        <p className="text-sm text-ink/50">Loading patient plan...</p>
      ) : !plan ? null : (
        <>
          <section className="app-surface mb-5 rounded-[24px] p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-ink">Medical conditions</h2>
            <form onSubmit={handleConditions} className="mt-4">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {CONDITION_OPTIONS.map((condition) => (
                  <label key={condition} className="flex items-center gap-2 text-sm text-ink/75">
                    <input
                      type="checkbox"
                      className="accent-clay"
                      checked={selectedConditions.includes(condition)}
                      onChange={(event) =>
                        setSelectedConditions((current) =>
                          event.target.checked
                            ? [...current, condition]
                            : current.filter((value) => value !== condition)
                        )
                      }
                    />
                    {condition}
                  </label>
                ))}
              </div>
              <div className="mt-4">
                <TextField
                  label="Other or custom conditions"
                  value={customConditions}
                  onChange={(event) => setCustomConditions(event.target.value)}
                  placeholder="Separate multiple conditions with commas"
                />
              </div>
              <Button className="mt-4" type="submit" loading={busy === "conditions"}>
                Save conditions
              </Button>
            </form>
          </section>

          <section className="app-surface mb-5 rounded-[24px] p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">Daily dietary limits</h2>
                <p className="mt-1 text-xs text-ink/50">
                  Current totals for {plan.date} in {plan.patient.timezone}
                </p>
              </div>
            </div>

            {plan.limits.length === 0 ? (
              <p className="mt-4 text-sm text-ink/50">No limits added.</p>
            ) : (
              <ul className="mt-4 divide-y divide-border-warm">
                {plan.limits.map((limit) => (
                  <li key={limit.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto]">
                    <div>
                      <p className="font-semibold text-ink">
                        {limit.name}: {formatNumber(Number(limit.maximum_amount))} {limit.unit} maximum
                      </p>
                      <p className={`mt-1 text-sm ${limit.exceeded ? "text-brick" : "text-ink/60"}`}>
                        Today: {limit.current_amount === null ? "not calculated" : `${formatNumber(limit.current_amount)} ${limit.unit}`}
                      </p>
                      {limit.explanation && <p className="mt-1 text-xs text-ink/50">{limit.explanation}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-sm text-ink/65">
                        <input
                          type="checkbox"
                          className="accent-clay"
                          checked={limit.enabled}
                          disabled={busy === `limit-${limit.id}`}
                          onChange={(event) => void toggleLimit(limit.id, event.target.checked)}
                        />
                        Enabled
                      </label>
                      <Button type="button" variant="secondary" onClick={() => editLimit(limit)}>Edit</Button>
                      <Button
                        type="button"
                        variant="danger"
                        loading={busy === `limit-${limit.id}`}
                        onClick={() => void deleteLimit(limit.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleLimit} className="mt-5 grid gap-3 border-t border-border-warm pt-5 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-semibold text-ink/70">
                Type
                <select
                  className={SELECT_CLASS}
                  value={limitDraft.limitType}
                  onChange={(event) =>
                    setLimitDraft((current) => ({
                      ...current,
                      limitType: event.target.value as DietaryLimitType,
                    }))
                  }
                >
                  <option value="nutrient">Nutrient</option>
                  <option value="ingredient">Ingredient</option>
                </select>
              </label>
              <TextField
                label="Name"
                required
                list="limit-name-options"
                value={limitDraft.name}
                onChange={(event) => setLimitDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder="Sodium or cooking oil"
              />
              <datalist id="limit-name-options">
                <option value="sodium" />
                <option value="sugar" />
                <option value="calories" />
                <option value="carbohydrates" />
                <option value="fat" />
                <option value="oil" />
              </datalist>
              <TextField
                label="Maximum daily amount"
                type="number"
                required
                min={0.01}
                step="any"
                value={limitDraft.maximumAmount}
                onChange={(event) => setLimitDraft((current) => ({ ...current, maximumAmount: event.target.value }))}
              />
              <label className="flex flex-col gap-2 text-sm font-semibold text-ink/70">
                Unit
                <select
                  className={SELECT_CLASS}
                  value={limitDraft.unit}
                  onChange={(event) =>
                    setLimitDraft((current) => ({ ...current, unit: event.target.value as DietaryLimitUnit }))
                  }
                >
                  <option value="mg">mg</option>
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  <option value="kcal">kcal</option>
                </select>
              </label>
              <div className="sm:col-span-2">
                <TextField
                  label="Doctor explanation (optional)"
                  value={limitDraft.explanation}
                  onChange={(event) => setLimitDraft((current) => ({ ...current, explanation: event.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-ink/70">
                <input
                  type="checkbox"
                  className="accent-clay"
                  checked={limitDraft.enabled}
                  onChange={(event) => setLimitDraft((current) => ({ ...current, enabled: event.target.checked }))}
                />
                Enabled
              </label>
              <div className="flex flex-wrap justify-end gap-2">
                {editingLimitId && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setEditingLimitId(null);
                      setLimitDraft(EMPTY_LIMIT);
                    }}
                  >
                    Cancel
                  </Button>
                )}
                <Button type="submit" loading={busy === "limit"}>
                  {editingLimitId ? "Update limit" : "Add limit"}
                </Button>
              </div>
            </form>
          </section>

          <section className="app-surface mb-5 rounded-[24px] p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-ink">Food guidance</h2>
            {plan.recommendations.length === 0 ? (
              <p className="mt-4 text-sm text-ink/50">No food guidance added.</p>
            ) : (
              <ul className="mt-4 divide-y divide-border-warm">
                {plan.recommendations.map((recommendation) => (
                  <li key={recommendation.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto]">
                    <div>
                      <p className="font-semibold text-ink">
                        {recommendation.food_name} · {recommendation.recommendation_type === "avoid" ? "avoid or limit" : "consume more"}
                      </p>
                      <p className="mt-1 text-sm text-ink/60">{recommendation.doctor_reason}</p>
                      <p className="mt-1 text-xs text-ink/45">
                        {recommendation.priority} priority
                        {recommendation.recommended_frequency ? ` · ${recommendation.recommended_frequency}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="secondary" onClick={() => editRecommendation(recommendation)}>Edit</Button>
                      <Button
                        type="button"
                        variant="danger"
                        loading={busy === `recommendation-${recommendation.id}`}
                        onClick={() => void deleteRecommendation(recommendation.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleRecommendation} className="mt-5 grid gap-3 border-t border-border-warm pt-5 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-semibold text-ink/70">
                List
                <select
                  className={SELECT_CLASS}
                  value={recommendationDraft.recommendationType}
                  onChange={(event) =>
                    setRecommendationDraft((current) => ({
                      ...current,
                      recommendationType: event.target.value as RecommendationType,
                    }))
                  }
                >
                  <option value="avoid">Avoid or limit</option>
                  <option value="consume_more">Consume more</option>
                </select>
              </label>
              <TextField
                label="Food name or category"
                required
                value={recommendationDraft.foodName}
                onChange={(event) => setRecommendationDraft((current) => ({ ...current, foodName: event.target.value }))}
              />
              <TextField
                label="Doctor reason"
                required
                value={recommendationDraft.doctorReason}
                onChange={(event) => setRecommendationDraft((current) => ({ ...current, doctorReason: event.target.value }))}
              />
              <label className="flex flex-col gap-2 text-sm font-semibold text-ink/70">
                Priority
                <select
                  className={SELECT_CLASS}
                  value={recommendationDraft.priority}
                  onChange={(event) =>
                    setRecommendationDraft((current) => ({
                      ...current,
                      priority: event.target.value as RecommendationPriority,
                    }))
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <div className="sm:col-span-2">
                <TextField
                  label="Recommended frequency (optional)"
                  value={recommendationDraft.recommendedFrequency}
                  onChange={(event) => setRecommendationDraft((current) => ({ ...current, recommendedFrequency: event.target.value }))}
                  placeholder="For example: once daily"
                />
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2 sm:justify-end">
                {editingRecommendationId && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setEditingRecommendationId(null);
                      setRecommendationDraft(EMPTY_RECOMMENDATION);
                    }}
                  >
                    Cancel
                  </Button>
                )}
                <Button type="submit" loading={busy === "recommendation"}>
                  {editingRecommendationId ? "Update guidance" : "Add guidance"}
                </Button>
              </div>
            </form>
          </section>

          <section className="app-surface rounded-[24px] p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-ink">Current daily totals</h2>
            {plan.daily_totals.length === 0 ? (
              <p className="mt-3 text-sm text-ink/50">No confirmed meals logged for this date.</p>
            ) : (
              <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {plan.daily_totals.map((total) => (
                  <div key={`${total.metric_key}-${total.unit}`}>
                    <dt className="text-xs text-ink/50">{total.metric_name}</dt>
                    <dd className="mt-1 font-semibold text-ink">
                      {formatNumber(total.amount)} {total.unit}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </>
      )}
    </>
  );
}

export default function DoctorPage() {
  return (
    <AppShell allowedRoles={["doctor"]}>
      <DoctorPageInner />
    </AppShell>
  );
}
