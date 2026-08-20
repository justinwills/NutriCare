"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/types/api";
import { getStoredToken, clearStoredToken } from "@/lib/api/client";
import * as authApi from "@/lib/api/auth";

// The backend has NO "GET /auth/me" or equivalent — verified against
// the real route files, only /auth/register and /auth/login exist.
// The JWT payload itself only carries userId + role (see
// middleware/auth.js), not fullName/email. So the full User object is
// only ever available right after a successful login response — there
// is no way to re-derive it from just a stored token. To survive a
// page reload without forcing a re-login, this context persists the
// User object itself in localStorage alongside the token, not just
// the token. If you add a GET /auth/me endpoint later, swap this
// stored-user approach for fetching it on mount instead — that would
// also let you detect a token that's still technically valid but
// whose backing user was deleted, which this approach can't.
const USER_STORAGE_KEY = "pantry_auth_user";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = getStoredToken();
    const storedUser = window.localStorage.getItem(USER_STORAGE_KEY);
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser) as User);
      } catch {
        // Corrupted stored value -- treat as logged out rather than crash.
        clearStoredToken();
        window.localStorage.removeItem(USER_STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  async function login(email: string, password: string) {
    const result = await authApi.login(email, password);
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(result.user));
    setUser(result.user);
  }

  function logout() {
    authApi.logout();
    window.localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
    router.push("/login");
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
