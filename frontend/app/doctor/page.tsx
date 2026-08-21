"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { ApiError } from "@/lib/api/client";
import * as doctorApi from "@/lib/api/doctor";
import type { DoctorPatientLink, NutrientKey } from "@/lib/types/api";
import { playAlertSound } from "@/lib/playAlertSound";

const NUTRIENTS: NutrientKey[] = [
  "calories",
  "protein",
  "carbohydrates",
  "fat",
  "sodium",
  "sugar",
  "fibre",
];

function DoctorPageInner() {
  const [patients, setPatients] = useState<DoctorPatientLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [patientId, setPatientId] = useState("");
  const [linking, setLinking] = useState(false);

  const [targetPatientId, setTargetPatientId] = useState("");
  const [nutrient, setNutrient] = useState<NutrientKey>("calories");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [savingTarget, setSavingTarget] = useState(false);

  const [checkPatientId, setCheckPatientId] = useState("");
  const [checkNutrient, setCheckNutrient] = useState<NutrientKey>("calories");
  const [checkValue, setCheckValue] = useState("");
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    const list = await doctorApi.listMyPatients();
    setPatients(list);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load patients");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  function pickPatient(id: string) {
    setPatientId(id);
    setTargetPatientId(id);
    setCheckPatientId(id);
  }

  async function handleLink(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setLinking(true);
    try {
      await doctorApi.linkPatient(patientId.trim());
      setStatus("Patient linked");
      setPatientId("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not link patient");
    } finally {
      setLinking(false);
    }
  }

  async function handleTarget(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setSavingTarget(true);
    try {
      await doctorApi.setNutritionTarget({
        patientId: targetPatientId.trim(),
        nutrient,
        ...(minValue !== "" ? { minValue: Number(minValue) } : {}),
        ...(maxValue !== "" ? { maxValue: Number(maxValue) } : {}),
      });
      setStatus(`Saved ${nutrient} target`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save target");
    } finally {
      setSavingTarget(false);
    }
  }

  async function handleCheck(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setChecking(true);
    try {
      const result = await doctorApi.checkNutritionValue({
        patientId: checkPatientId.trim(),
        nutrient: checkNutrient,
        value: Number(checkValue),
      });
      if (result.flagged) playAlertSound();
      setStatus(
        result.flagged
          ? "Out of range — notification created for the patient"
          : "Within range (or no target set)"
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Check failed");
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Doctor tools</h1>
        <p className="mt-1 text-sm text-ink/60">
          Link patients, set nutrition targets, and check values
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

      <section className="mb-6 rounded-2xl border border-border-warm bg-white/60 p-4">
        <h2 className="mb-3 text-lg font-semibold text-ink">Linked patients</h2>
        {loading ? (
          <p className="text-sm text-ink/55">Loading…</p>
        ) : patients.length === 0 ? (
          <p className="text-sm text-ink/55">No patients linked yet.</p>
        ) : (
          <ul className="mb-4 flex flex-col gap-2">
            {patients.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-warm bg-paper/60 px-3 py-2"
              >
                <div>
                  <p className="font-medium text-ink">{p.full_name}</p>
                  <p className="text-xs text-ink/60">
                    {p.email} · {p.status}
                  </p>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-ink/45">{p.id}</p>
                </div>
                <Button type="button" variant="secondary" onClick={() => pickPatient(p.id)}>
                  Use ID
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleLink} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <TextField
              label="Patient user ID"
              required
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="uuid from patient's pantry page"
            />
          </div>
          <Button type="submit" loading={linking}>
            Link patient
          </Button>
        </form>
      </section>

      <section className="mb-6 rounded-2xl border border-border-warm bg-white/60 p-4">
        <h2 className="mb-3 text-lg font-semibold text-ink">Nutrition target</h2>
        <form onSubmit={handleTarget} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField
              label="Patient ID"
              required
              value={targetPatientId}
              onChange={(e) => setTargetPatientId(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink/80">Nutrient</label>
            <select
              className="rounded-lg border border-border-warm bg-white px-3.5 py-2.5"
              value={nutrient}
              onChange={(e) => setNutrient(e.target.value as NutrientKey)}
            >
              {NUTRIENTS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Min"
              type="number"
              step="any"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
            />
            <TextField
              label="Max"
              type="number"
              step="any"
              value={maxValue}
              onChange={(e) => setMaxValue(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" loading={savingTarget}>
              Save target
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-border-warm bg-white/60 p-4">
        <h2 className="mb-3 text-lg font-semibold text-ink">Check nutrition value</h2>
        <p className="mb-3 text-xs text-ink/55">
          Reports a value against the patient&apos;s target (used after meal nutrition calc).
        </p>
        <form onSubmit={handleCheck} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField
              label="Patient ID"
              required
              value={checkPatientId}
              onChange={(e) => setCheckPatientId(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink/80">Nutrient</label>
            <select
              className="rounded-lg border border-border-warm bg-white px-3.5 py-2.5"
              value={checkNutrient}
              onChange={(e) => setCheckNutrient(e.target.value as NutrientKey)}
            >
              {NUTRIENTS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <TextField
            label="Value"
            type="number"
            step="any"
            required
            value={checkValue}
            onChange={(e) => setCheckValue(e.target.value)}
          />
          <div className="sm:col-span-2">
            <Button type="submit" loading={checking}>
              Check value
            </Button>
          </div>
        </form>
      </section>
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
