import { apiRequest } from "./client";
import { parseNotification, type NotificationView } from "./parse";
import type { RawNotification } from "@/lib/types/api";

export async function listNotifications(
  options: { unreadOnly?: boolean } = {}
): Promise<NotificationView[]> {
  const query = options.unreadOnly ? "?unread=true" : "";
  const result = await apiRequest<{ notifications: RawNotification[] }>(
    `/notifications${query}`
  );
  return result.notifications.map(parseNotification);
}

export async function markNotificationRead(id: string): Promise<NotificationView> {
  const result = await apiRequest<{ notification: RawNotification }>(
    `/notifications/${id}/read`,
    { method: "PATCH" }
  );
  return parseNotification(result.notification);
}
