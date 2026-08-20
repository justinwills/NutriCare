import { apiRequest, setStoredToken, clearStoredToken } from "./client";
import type { AuthResponse, RawUserFromRegister, UserRole } from "@/lib/types/api";

export async function login(email: string, password: string): Promise<AuthResponse> {
  const result = await apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
    requiresAuth: false,
  });
  setStoredToken(result.token);
  return result;
}

// Note: register does NOT return a token -- only login does (see
// authService.js, verified live). The register screen must send the
// user straight to login after a successful registration; it can't
// sign them in directly from the register response.
export async function register(input: {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
}): Promise<{ user: RawUserFromRegister }> {
  return apiRequest<{ user: RawUserFromRegister }>("/auth/register", {
    method: "POST",
    body: input,
    requiresAuth: false,
  });
}

export function logout(): void {
  clearStoredToken();
}
