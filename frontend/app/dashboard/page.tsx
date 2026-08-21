"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { RecommendationLists } from "@/components/supervision/RecommendationLists";
import { ApiError } from "@/lib/api/client";
import * as supervisionApi from "@/lib/api/supervision";
import { useAuth } from "@/lib/auth/context";
import type { SupervisionPlan } from "@/lib/types/api";

function formatNumber(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function DashboardInner() {
  const { user } = useAuth();
  const router = useRouter();
  const [plan, setPlan] = useState<SupervisionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    await supervisionApi.updateMyTimezone(timezone);
    setPlan(await supervisionApi.getMyPlan());
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.role === "doctor") {
      router.replace("/doctor");
      return;
    }
    if (user.role === "personal") {
      router.replace("/pantry");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadPlan();
        if (!cancelled) setError(null);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : "Could not load your care plan");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPlan, router, user]);

  if (user?.role !== "hospital_patient") return null;

  return (
    <>
      <div className="mb-8">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-sage">
          Doctor supervision
        </p>
        <h1 className="font-display text-4xl font-semibold text-ink sm:text-5xl">Your care plan</h1>
        <p className="mt-2 text-sm text-ink/55">
          Daily guidance entered by your linked care team
        </p>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-brick/10 px-3 py-2 text-sm text-brick">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-ink/55">Loading your care plan...</p>
      ) : !plan ? null : (
        <div className="flex flex-col gap-5">
          <section className="app-surface rounded-[24px] p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">Today&apos;s limits</h2>
                <p className="mt-1 text-xs text-ink/50">
                  {plan.date} in {plan.patient.timezone}
                </p>
              </div>
            </div>
            {plan.limits.length === 0 ? (
              <p className="mt-4 text-sm text-ink/50">No daily limits have been added.</p>
            ) : (
              <ul className="mt-5 grid gap-5 md:grid-cols-2">
                {plan.limits.map((limit) => {
                  const maximum = Number(limit.maximum_amount);
                  const progress = limit.progress_percent === null
                    ? 0
                    : Math.max(0, Math.min(100, limit.progress_percent));
                  return (
                    <li key={limit.id} className="border-b border-border-warm pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{limit.name}</p>
                          <p className="text-xs text-ink/50">{limit.limit_type}</p>
                        </div>
                        <span className={`text-xs font-semibold ${limit.enabled ? "text-sage" : "text-ink/40"}`}>
                          {limit.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                      <p className={`mt-3 text-sm font-semibold ${limit.exceeded ? "text-brick" : "text-ink"}`}>
                        {limit.current_amount === null
                          ? "No calculated value"
                          : `${formatNumber(limit.current_amount)} of ${formatNumber(maximum)} ${limit.unit}`}
                      </p>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-border-warm/70">
                        <div
                          className={`h-full ${limit.exceeded ? "bg-brick" : "bg-sage"}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      {limit.explanation && (
                        <p className="mt-2 text-xs text-ink/55">{limit.explanation}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="app-surface rounded-[24px] p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-ink">Medical conditions</h2>
            {plan.conditions.length === 0 ? (
              <p className="mt-3 text-sm text-ink/50">No conditions have been entered by your doctor.</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {plan.conditions.map((condition) => (
                  <li key={condition.id} className="rounded-full border border-border-warm bg-white px-3 py-1.5 text-sm text-ink/75">
                    {condition.condition_name}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="app-surface rounded-[24px] p-5 sm:p-6">
            <h2 className="mb-5 text-lg font-semibold text-ink">Food guidance</h2>
            <RecommendationLists items={plan.recommendations} />
          </section>

          <section className="app-surface rounded-[24px] p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-ink">Calculated today</h2>
            {plan.daily_totals.length === 0 ? (
              <p className="mt-3 text-sm text-ink/50">No confirmed meals logged today.</p>
            ) : (
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
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
        </div>
      )}
    </>
  );
}

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardInner />
    </AppShell>
  );
}
