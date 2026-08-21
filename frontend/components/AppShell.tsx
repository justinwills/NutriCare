"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth/context";
import type { UserRole } from "@/lib/types/api";

const NAV: { href: string; label: string; roles?: UserRole[] }[] = [
  { href: "/pantry", label: "Pantry" },
  { href: "/meals", label: "Meals" },
  { href: "/notifications", label: "Alerts" },
  { href: "/doctor", label: "Doctor", roles: ["doctor"] },
];

function ShellInner({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const links = NAV.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border-warm bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <Link href="/pantry" className="font-display text-xl font-semibold text-ink">
              NutriCare
            </Link>
            <p className="truncate text-xs text-ink/55">
              {user?.fullName} · {user?.role}
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={logout} className="shrink-0">
            Log out
          </Button>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-3">
          {links.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-clay text-white"
                    : "bg-white text-ink/70 ring-1 ring-border-warm hover:bg-border-warm/30"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</div>
    </div>
  );
}

export function AppShell({
  children,
  allowedRoles,
}: {
  children: ReactNode;
  allowedRoles?: UserRole[];
}) {
  return (
    <RequireAuth allowedRoles={allowedRoles}>
      <ShellInner>{children}</ShellInner>
    </RequireAuth>
  );
}
