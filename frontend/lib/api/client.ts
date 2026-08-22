// Base request wrapper — auth header, JSON parsing, typed errors.
// Verified against the real backend: Bearer token scheme matches
// middleware/auth.js, error shape { error: "..." } matches every
// route's catch block.

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/$/, "");

function resolveApiUrl(path: string): string {
  if (!API_BASE_URL) {
    throw new ApiError(
      "Frontend configuration error: NEXT_PUBLIC_API_BASE_URL is missing.",
      500,
      {
        hint:
          "Set NEXT_PUBLIC_API_BASE_URL to your deployed backend URL (example: https://your-backend-domain.com).",
      }
    );
  }

  // Catch the common deploy mistake where localhost is baked into a production build.
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    /^https?:\/\/localhost(?::\d+)?$/i.test(API_BASE_URL)
  ) {
    throw new ApiError(
      "Frontend configuration error: NEXT_PUBLIC_API_BASE_URL points to localhost in production.",
      500,
      {
        hint:
          "In your hosting dashboard, set NEXT_PUBLIC_API_BASE_URL to your public backend URL and redeploy.",
      }
    );
  }

  return `${API_BASE_URL}${path}`;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

const TOKEN_STORAGE_KEY = "pantry_auth_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string): void {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken(): void {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  // Most routes need a token; auth/register and auth/login don't have
  // one yet, so this defaults to true and those two calls opt out.
  requiresAuth?: boolean;
}

/**
 * Every screen's data-fetching goes through this function. Centralizing
 * it here means: one place to add the auth header, one place that
 * throws a typed ApiError on failure (so screens can catch it and show
 * a real message instead of a generic "something went wrong"), and one
 * place to update if the backend's base URL or auth header scheme
 * changes.
 */
export async function apiRequest<T>(
  path: string,
  { method = "GET", body, requiresAuth = true }: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (requiresAuth) {
    const token = getStoredToken();
    if (!token) {
      throw new ApiError("Not signed in", 401, null);
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(resolveApiUrl(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : null) ?? `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status, data);
  }

  return data as T;
}
