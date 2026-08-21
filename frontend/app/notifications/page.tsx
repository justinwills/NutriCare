"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { RecommendationLists } from "@/components/supervision/RecommendationLists";
import { ApiError } from "@/lib/api/client";
import * as notifApi from "@/lib/api/notifications";
import * as supervisionApi from "@/lib/api/supervision";
import type { NotificationView } from "@/lib/api/parse";
import { useAuth } from "@/lib/auth/context";
import type { FoodRecommendation } from "@/lib/types/api";

function NotificationsPageInner() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationView[]>([]);
  const [recommendations, setRecommendations] = useState<FoodRecommendation[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [list, plan] = await Promise.all([
      notifApi.listNotifications({ unreadOnly }),
      user?.role === "hospital_patient" ? supervisionApi.getMyPlan() : Promise.resolve(null),
    ]);
    setItems(list);
    setRecommendations(plan?.recommendations ?? []);
  }, [unreadOnly, user?.role]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await refresh();
        if (!cancelled) setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load notifications");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  async function markRead(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await notifApi.markNotificationRead(id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not mark as read");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-sage">Stay ahead</p>
          <h1 className="font-display text-4xl font-semibold tracking-[-0.04em] text-ink sm:text-5xl">Your alerts</h1>
          <p className="mt-2 text-sm text-ink/55">
            Low stock, expiry, and nutrition target notifications
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-ink/70">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="accent-clay"
            />
            Unread only
          </label>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-brick/10 px-3 py-2 text-sm text-brick">
          {error}
        </p>
      )}

      {user?.role === "hospital_patient" && !loading && (
        <section className="mb-6 border-y border-border-warm py-5">
          <h2 className="mb-4 text-lg font-semibold text-ink">Doctor guidance</h2>
          <RecommendationLists items={recommendations} />
        </section>
      )}

      {loading ? (
        <p className="text-sm text-ink/55">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink/55">No notifications.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((n) => (
            <li
              key={n.id}
              className={`rounded-[22px] border p-5 shadow-[0_12px_40px_rgba(23,37,30,0.04)] transition hover:-translate-y-0.5 ${
                n.read
                  ? "border-border-warm bg-white/50"
                  : "border-clay/30 bg-clay/5"
              }`}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {n.type.replaceAll("_", " ")}
                    {!n.read ? " · unread" : ""}
                  </p>
                  <p className="mt-1 text-sm text-ink/75">{n.message}</p>
                  <p className="mt-1 text-xs text-ink/50">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
                {!n.read && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0"
                    loading={busyId === n.id}
                    onClick={() => markRead(n.id)}
                  >
                    Mark read
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function NotificationsPage() {
  return (
    <AppShell>
      <NotificationsPageInner />
    </AppShell>
  );
}
