"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import type { UserRole } from "@/lib/types/api";

interface RequireAuthProps {
  children: ReactNode;
  /** If set, only these roles may view this page; others are redirected. */
  allowedRoles?: UserRole[];
}

/**
 * Wrap any page's content in this to gate it behind a signed-in
 * session, and optionally a specific role. Renders nothing (not even
 * a flash of the real content) while the redirect is in flight.
 */
export function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      router.replace("/pantry");
    }
  }, [loading, user, allowedRoles, router]);

  if (loading || !user) return null;
  if (allowedRoles && !allowedRoles.includes(user.role)) return null;

  return <>{children}</>;
}
