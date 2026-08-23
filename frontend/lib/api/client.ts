// Base request wrapper — auth header, JSON parsing, typed errors.
// Verified against the real backend: Bearer token scheme matches
// middleware/auth.js, error shape { error: "..." } matches every
// route's catch block.

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/$/, "");
const API_PREFIX = "/api";

function resolveApiUrl(path: string): string {
  const apiPath = path === API_PREFIX || path.startsWith(`${API_PREFIX}/`)
    ? path
    : `${API_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;

  if (!API_BASE_URL) {
    // When NEXT_PUBLIC_API_BASE_URL is not set, use relative path (same-origin).
    // Next.js rewrites or same-origin deployment will proxy/route this to the backend.
    return apiPath;
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

  return `${API_BASE_URL}${apiPath}`;
}

// Shown when the server responded, but not with the JSON { error } shape
// every real route in this backend uses on failure (see server.js's last-
// resort handler and every route's own catch block). That mismatch means
// the request never reached actual route logic — it was intercepted
// somewhere before that (wrong host, wrong path, a platform's own 404/50x
// page, a sleeping/never-deployed backend, CORS, etc.) — so the true cause
// isn't something this client can know for certain.
function fallbackMessageForStatus(status: number): string {
  if (status === 404)
    return "The server endpoint was not found (404). Check NEXT_PUBLIC_API_BASE_URL or BACKEND_URL in your deployment settings.";
  if (status === 401 || status === 403) return "You're not authorized to do that. Try signing in again.";
  if (status >= 500) return "The server had a problem on its end. Please try again shortly.";
  return `The server didn't accept that request (status ${status}). Please try again.`;
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

  const url = resolveApiUrl(path);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    // fetch() itself throwing (rather than resolving with a bad status)
    // means the request never got a response at all — offline, DNS
    // failure, connection refused, or blocked by CORS.
    console.error(`[api] ${method} ${url} -> network error before any response:`, networkErr);
    throw new ApiError(
      "Couldn't connect to the server. Check your connection and try again.",
      0,
      { cause: networkErr }
    );
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    const serverMessage =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : null;

    if (!serverMessage) {
      // The response didn't come from this app's own error handling —
      // log the technical detail for whoever's debugging the deploy,
      // and show the person something short and honest instead of a
      // bare status code.
      console.error(
        `[api] ${method} ${path} -> ${res.status} with a non-JSON or unrecognized body. ` +
          `Base URL in use: ${API_BASE_URL || "(empty)"}. This usually means the request ` +
          `didn't reach a real route on the backend — check NEXT_PUBLIC_API_BASE_URL and ` +
          `that the backend is actually deployed and running.`
      );
    }

    throw new ApiError(serverMessage ?? fallbackMessageForStatus(res.status), res.status, data);
  }

  return data as T;
}
