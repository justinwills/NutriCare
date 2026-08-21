// Base request wrapper — auth header, JSON parsing, typed errors.
// Verified against the real backend: Bearer token scheme matches
// middleware/auth.js, error shape { error: "..." } matches every
// route's catch block.

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE_URL && typeof window !== "undefined") {
  // Fail loudly in the browser console rather than silently hitting
  // a relative path that 404s — this is the single most likely setup
  // mistake (forgetting to set .env.local before `npm run dev`).
  console.error(
    "NEXT_PUBLIC_API_BASE_URL is not set. Copy .env.local.example to " +
      ".env.local and set it to your backend's URL."
  );
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

  const res = await fetch(`${API_BASE_URL}${path}`, {
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
