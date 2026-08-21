"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api/client";
import * as notifApi from "@/lib/api/notifications";
import type { NotificationView } from "@/lib/api/parse";

function NotificationsPageInner() {
  const [items, setItems] = useState<NotificationView[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const list = await notifApi.listNotifications({ unreadOnly });
    setItems(list);
  }, [unreadOnly]);

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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Alerts</h1>
          <p className="mt-1 text-sm text-ink/60">
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

      {loading ? (
        <p className="text-sm text-ink/55">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink/55">No notifications.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((n) => (
            <li
              key={n.id}
              className={`rounded-2xl border p-4 ${
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
