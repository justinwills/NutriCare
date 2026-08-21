import { apiRequest } from "./client";
import type { DailyConsumptionTotal, SupervisionPlan } from "@/lib/types/api";

export async function getMyPlan(): Promise<SupervisionPlan> {
  const result = await apiRequest<{ plan: SupervisionPlan }>("/supervision");
  return result.plan;
}

export async function getMyDailyTotals(): Promise<{
  date: string;
  timezone: string;
  totals: DailyConsumptionTotal[];
}> {
  return apiRequest("/supervision/daily-totals");
}

export async function updateMyTimezone(timezone: string): Promise<string> {
  const result = await apiRequest<{ timezone: string }>("/supervision/timezone", {
    method: "PUT",
    body: { timezone },
  });
  return result.timezone;
}
