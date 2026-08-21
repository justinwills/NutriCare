"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as authApi from "@/lib/api/auth";
import { useAuth } from "@/lib/auth/context";
import { ApiError } from "@/lib/api/client";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { AuthScaffold } from "@/components/AuthScaffold";
import type { UserRole } from "@/lib/types/api";

const ROLE_OPTIONS: { value: UserRole; label: string; blurb: string }[] = [
  {
    value: "personal",
    label: "Personal use",
    blurb: "Track your own pantry, meals, and nutrition.",
  },
  {
    value: "hospital_patient",
    label: "Hospital patient",
    blurb: "Your doctor can set nutrition targets and monitor your intake.",
  },
  {
    value: "doctor",
    label: "Doctor",
    blurb: "Monitor linked patients and set their nutrition targets.",
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!role) {
      setError("Choose how you'll use NutriCare.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    setSubmitting(true);
    try {
      // Backend register does not return a JWT, so sign in immediately
      // afterward and land on the dashboard in one step.
      await authApi.register({
        email: normalizedEmail,
        password,
        fullName,
        role,
      });
      await login(normalizedEmail, password);
      router.push("/pantry");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthScaffold eyebrow="Start fresh" title="Build a clearer food routine." description="Choose the account that fits your needs. You can set up your first pantry item right after this.">
        <form onSubmit={handleSubmit} className="app-surface flex flex-col gap-5 rounded-[24px] p-5 sm:p-6">
          <TextField
            label="Full name"
            name="fullName"
            autoComplete="name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <TextField
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-ink/80">
              How will you use NutriCare?
            </legend>
            {ROLE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border px-3.5 py-3 transition ${
                  role === option.value
                    ? "border-sage/50 bg-sage/8 ring-2 ring-sage/10"
                    : "border-border-warm bg-white/50 hover:border-sage/25 hover:bg-white"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-ink">
                  <input
                    type="radio"
                    name="role"
                    value={option.value}
                    checked={role === option.value}
                    onChange={() => setRole(option.value)}
                    className="accent-clay"
                  />
                  {option.label}
                </span>
                <span className="pl-6 text-xs text-ink/60">{option.blurb}</span>
              </label>
            ))}
          </fieldset>

          {error && (
            <p role="alert" className="rounded-lg bg-brick/10 px-3 py-2 text-sm text-brick">
              {error}
            </p>
          )}

          <Button type="submit" loading={submitting} className="mt-1 w-full">
            Create account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink/55">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-clay hover:underline">
            Sign in
          </Link>
        </p>
    </AuthScaffold>
  );
}
