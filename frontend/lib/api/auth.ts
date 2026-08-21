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

// Register does not return a JWT (backend only issues one on /auth/login).
// Callers should login right after a successful register for a one-step signup.
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
