"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Icon, type IconName } from "@/components/ui/Icons";
import { useAuth } from "@/lib/auth/context";
import type { UserRole } from "@/lib/types/api";

const NAV: { href: string; label: string; icon: IconName; roles?: UserRole[] }[] = [
  { href: "/pantry", label: "Pantry", icon: "pantry" },
  { href: "/meals", label: "Meals", icon: "meal" },
  { href: "/notifications", label: "Alerts", icon: "alert" },
  { href: "/doctor", label: "Doctor", icon: "doctor", roles: ["doctor"] },
];

const ROLE_LABEL: Record<UserRole, string> = {
  personal: "Personal account",
  hospital_patient: "Patient account",
  doctor: "Clinical account",
};

function Brand() {
  return (
    <Link href="/pantry" className="group inline-flex items-center gap-3" aria-label="NutriCare home">
      <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-lime text-forest shadow-[0_8px_24px_rgba(220,233,131,0.16)] transition group-hover:-rotate-3">
        <Icon name="leaf" className="h-5 w-5" />
      </span>
      <span>
        <span className="block font-display text-xl font-semibold leading-none tracking-[-0.02em] text-white">
          NutriCare
        </span>
        <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-white/42">
          Eat with clarity
        </span>
      </span>
    </Link>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const links = NAV.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );
  const current = links.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
  const initials = user?.fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-paper lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="soft-noise sticky top-0 hidden h-screen flex-col overflow-hidden bg-forest px-4 py-5 text-white lg:flex">
        <div className="absolute -right-20 top-24 h-52 w-52 rounded-full bg-lime/8 blur-3xl" />
        <div className="relative px-2">
          <Brand />
        </div>

        <nav className="relative mt-12 flex flex-col gap-1.5" aria-label="Main navigation">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
            Your space
          </p>
          {links.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition ${
                  active
                    ? "bg-white text-forest shadow-[0_10px_35px_rgba(0,0,0,0.12)]"
                    : "text-white/64 hover:bg-white/7 hover:text-white"
                }`}
              >
                <Icon
                  name={item.icon}
                  className={`h-5 w-5 ${active ? "text-clay" : "text-white/52 group-hover:text-lime"}`}
                />
                {item.label}
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-clay" />}
              </Link>
            );
          })}
        </nav>

        <div className="relative mt-auto rounded-[22px] border border-white/10 bg-white/[0.06] p-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-lime text-xs font-bold text-forest">
              {initials || "NC"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user?.fullName}</p>
              <p className="truncate text-[11px] text-white/45">
                {user ? ROLE_LABEL[user.role] : "Signed in"}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white/45 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
              aria-label="Log out"
              title="Log out"
            >
              <Icon name="logout" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border-warm/70 bg-paper/88 px-4 py-3 backdrop-blur-xl lg:hidden">
          <Link href="/pantry" className="inline-flex items-center gap-2 font-display text-lg font-semibold text-ink">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-forest text-lime">
              <Icon name="leaf" className="h-4 w-4" />
            </span>
            NutriCare
          </Link>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink/62 shadow-sm ring-1 ring-border-warm">
            {current?.label ?? "Overview"}
          </span>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>

        <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-flow-col auto-cols-fr rounded-[22px] border border-white/70 bg-forest/96 p-1.5 shadow-[0_16px_50px_rgba(21,53,42,0.25)] backdrop-blur-xl lg:hidden" aria-label="Mobile navigation">
          {links.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-[17px] px-2 py-2 text-[10px] font-semibold transition ${
                  active ? "bg-white text-forest" : "text-white/55"
                }`}
              >
                <Icon name={item.icon} className={`h-5 w-5 ${active ? "text-clay" : ""}`} />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
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
