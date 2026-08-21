"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { ApiError } from "@/lib/api/client";
import * as pantryApi from "@/lib/api/pantry";
import * as ocrApi from "@/lib/api/ocr";
import type { PantryItemView } from "@/lib/api/parse";
import { formatQty, unitsForBase } from "@/lib/units";
import type { BaseUnit, MeasurementUnit } from "@/lib/types/api";
import type { ScannedPantryItem } from "@/lib/types/api";
import { useAuth } from "@/lib/auth/context";
import { playAlertSound } from "@/lib/playAlertSound";

function PantryPageInner() {
  const { user } = useAuth();
  const [items, setItems] = useState<PantryItemView[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [productName, setProductName] = useState("");
  const [initialQuantity, setInitialQuantity] = useState("");
  const [baseUnit, setBaseUnit] = useState<BaseUnit>("g");
  const [expirationDate, setExpirationDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScannedPantryItem[]>([]);
  const [scanNames, setScanNames] = useState<Record<number, string>>({});
  const [savingScan, setSavingScan] = useState<string | null>(null);

  const [deductQty, setDeductQty] = useState<Record<string, string>>({});
  const [deductUnit, setDeductUnit] = useState<Record<string, MeasurementUnit>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const list = await pantryApi.listPantryItems();
    setItems(list);
    setDeductUnit((prev) => {
      const next = { ...prev };
      for (const item of list) {
        if (!next[item.id]) next[item.id] = item.baseUnit;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load pantry");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setAdding(true);
    try {
      await pantryApi.createPantryItem({
        productName: productName.trim(),
        initialQuantity: Number(initialQuantity),
        baseUnit,
        expirationDate: expirationDate || undefined,
        source: "manual",
      });
      setProductName("");
      setInitialQuantity("");
      setExpirationDate("");
      setStatus("Item added to pantry");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add item");
    } finally {
      setAdding(false);
    }
  }

  async function handleScan(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a PNG, JPEG, or WebP image");
      return;
    }
    if (file.size > 7 * 1024 * 1024) {
      setError("Choose an image smaller than 7 MB");
      return;
    }
    setError(null);
    setStatus(null);
    setScanning(true);
    try {
      const imageData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read this image"));
        reader.readAsDataURL(file);
      });
      const results = await ocrApi.scanReceipt(imageData);
      setScanResults(results);
      setScanNames(Object.fromEntries(results.map((item, index) => [index, item.suggestedName])));
      setStatus(results.length ? "Review the detected items, then add the ones you want." : "No products were detected. Try a clearer receipt image.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not scan this image");
    } finally {
      setScanning(false);
    }
  }

  async function saveScannedItem(item: ScannedPantryItem, index: number) {
    const key = `${index}-${item.suggestedName}`;
    const productName = (scanNames[index] ?? item.suggestedName).trim();
    if (!productName) {
      setError("Enter a product name before adding it to the pantry");
      return;
    }
    setSavingScan(key);
    setError(null);
    try {
      await pantryApi.createPantryItem({
        productName,
        rawName: item.rawName,
        initialQuantity: item.initialQuantity,
        baseUnit: item.baseUnit,
        source: "ocr_receipt",
      });
      setScanResults((current) => current.filter((_, currentIndex) => currentIndex !== index));
      setScanNames((current) =>
        Object.fromEntries(
          Object.entries(current)
            .filter(([key]) => Number(key) !== index)
            .map(([key, value]) => [Number(key) > index ? Number(key) - 1 : Number(key), value])
        )
      );
      setStatus(`${productName} added to pantry`);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add scanned item");
    } finally {
      setSavingScan(null);
    }
  }

  async function handleDeduct(item: PantryItemView) {
    setError(null);
    setStatus(null);
    const quantityUsed = Number(deductQty[item.id]);
    const unit = deductUnit[item.id] ?? item.baseUnit;
    if (!quantityUsed || quantityUsed <= 0) {
      setError("Enter a quantity to deduct");
      return;
    }
    setBusyId(item.id);
    try {
      const result = await pantryApi.deductFromPantryItem(item.id, quantityUsed, unit);
      if (result.notificationCreated) playAlertSound();
      setDeductQty((prev) => ({ ...prev, [item.id]: "" }));
      setStatus(
        result.itemDeleted
          ? `${item.productName} is finished and was removed from the pantry`
          : `Deducted from ${item.productName}`
      );
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Deduction failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleExpiryScan() {
    setError(null);
    setStatus(null);
    try {
      const flagged = await pantryApi.checkExpiringItems();
      if (flagged > 0) playAlertSound();
      setStatus(`Expiry scan done — flagged ${flagged} item(s)`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Scan failed");
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Pantry</h1>
          <p className="mt-1 text-sm text-ink/60">Add items, deduct usage, scan for expiry</p>
        </div>
        <Button type="button" variant="secondary" onClick={handleExpiryScan}>
          Scan expiring
        </Button>
      </div>

      {(user?.role === "hospital_patient" || user?.role === "personal") && (
        <p className="mb-4 rounded-xl border border-border-warm bg-white/50 px-3 py-2 text-xs text-ink/60 break-all">
          Your user ID (for doctor linking): <span className="font-mono text-ink">{user.id}</span>
        </p>
      )}

      {status && (
        <p className="mb-3 rounded-lg bg-sage/10 px-3 py-2 text-sm text-sage">{status}</p>
      )}
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-brick/10 px-3 py-2 text-sm text-brick">
          {error}
        </p>
      )}

      <section className="mb-6 rounded-2xl border border-border-warm bg-white/60 p-4">
        <h2 className="font-display text-lg font-semibold text-ink">Scan a receipt</h2>
        <p className="mt-1 text-sm text-ink/60">Upload a receipt or grocery-order screenshot. We’ll extract products for you to review.</p>
        <label className="mt-3 inline-flex cursor-pointer items-center rounded-lg bg-clay px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-clay/90">
          {scanning ? "Scanning…" : "Choose image"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={scanning}
            onChange={(event) => {
              void handleScan(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        {scanResults.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2" aria-label="Scanned items">
            {scanResults.map((item, index) => {
              const key = `${index}-${item.suggestedName}`;
              return (
                <li key={key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-warm bg-white p-3">
                  <div>
                    <label className="flex flex-col gap-1 text-sm font-medium text-ink">
                      Product name
                      <input
                        className="w-full rounded-lg border border-border-warm bg-white px-2.5 py-1.5 text-base font-normal text-ink outline-none focus:border-clay focus:ring-2 focus:ring-clay/20"
                        value={scanNames[index] ?? item.suggestedName}
                        onChange={(event) =>
                          setScanNames((current) => ({ ...current, [index]: event.target.value }))
                        }
                      />
                    </label>
                    <p className="text-sm text-ink/60">{formatQty(item.initialQuantity, item.baseUnit)} · {Math.round(item.confidence * 100)}% OCR confidence</p>
                  </div>
                  <Button type="button" variant="secondary" loading={savingScan === key} onClick={() => void saveScannedItem(item, index)}>
                    Add to pantry
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <form
        onSubmit={handleAdd}
        className="mb-6 grid gap-3 rounded-2xl border border-border-warm bg-white/60 p-4 sm:grid-cols-2"
      >
        <TextField
          label="Product name"
          required
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder="Olive oil"
        />
        <TextField
          label="Quantity"
          type="number"
          required
          min={0.01}
          step="any"
          value={initialQuantity}
          onChange={(e) => setInitialQuantity(e.target.value)}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink/80">Unit</label>
          <select
            className="rounded-lg border border-border-warm bg-white px-3.5 py-2.5 text-base text-ink outline-none focus:border-clay focus:ring-2 focus:ring-clay/20"
            value={baseUnit}
            onChange={(e) => setBaseUnit(e.target.value as BaseUnit)}
          >
            <option value="g">g (mass)</option>
            <option value="ml">ml (volume)</option>
          </select>
        </div>
        <TextField
          label="Expiration (optional)"
          type="date"
          value={expirationDate}
          onChange={(e) => setExpirationDate(e.target.value)}
        />
        <div className="sm:col-span-2">
          <Button type="submit" loading={adding} className="w-full sm:w-auto">
            Add to pantry
          </Button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-ink/55">Loading pantry…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink/55">No pantry items yet. Add one above.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const low = item.remainingRatio < 0.15;
            const units = unitsForBase(item.baseUnit);
            return (
              <li
                key={item.id}
                className="rounded-2xl border border-border-warm bg-white/70 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">{item.productName}</p>
                    <p className="mt-0.5 text-sm text-ink/60">
                      {formatQty(item.remainingQuantity, item.baseUnit)} left of{" "}
                      {formatQty(item.initialQuantity, item.baseUnit)}
                      {item.expirationDate ? ` · expires ${item.expirationDate}` : ""}
                      {low ? " · low stock" : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-border-warm/50 px-2 py-0.5 text-xs text-ink/60">
                    {item.source}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-border-warm">
                  <div
                    className={`h-full ${low ? "bg-brick" : "bg-sage"}`}
                    style={{ width: `${Math.max(0, Math.min(100, item.remainingRatio * 100))}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="w-24">
                    <TextField
                      label="Use"
                      type="number"
                      min={0.01}
                      step="any"
                      value={deductQty[item.id] ?? ""}
                      onChange={(e) =>
                        setDeductQty((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-ink/80">Unit</label>
                    <select
                      className="rounded-lg border border-border-warm bg-white px-3 py-2.5 text-sm"
                      value={deductUnit[item.id] ?? item.baseUnit}
                      onChange={(e) =>
                        setDeductUnit((prev) => ({
                          ...prev,
                          [item.id]: e.target.value as MeasurementUnit,
                        }))
                      }
                    >
                      {units.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    loading={busyId === item.id}
                    onClick={() => handleDeduct(item)}
                  >
                    Deduct
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function PantryPage() {
  return (
    <AppShell>
      <PantryPageInner />
    </AppShell>
  );
}
