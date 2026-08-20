"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as authApi from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import type { UserRole } from "@/lib/types/api";

// role is REQUIRED by the backend at registration time (registerUser
// throws if it's not one of these three — verified against
// authService.js and live), so role selection has to be part of this
// same form, not a separate post-registration onboarding step.
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
      setError("Choose how you'll use Pantry.");
      return;
    }

    setSubmitting(true);
    try {
      await authApi.register({ email, password, fullName, role });
      // register does NOT return a token (verified live — only /auth/login
      // does), so there's no session to start here. Send them to login
      // with the email pre-filled instead of pretending they're signed in.
      router.push(`/login?email=${encodeURIComponent(email)}&registered=1`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-semibold text-ink">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-ink/60">
            Set up your pantry in a minute
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-2xl border border-border-warm bg-white/60 p-6">
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
              How will you use Pantry?
            </legend>
            {ROLE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border px-3.5 py-2.5 transition ${
                  role === option.value
                    ? "border-clay bg-clay/5 ring-1 ring-clay/30"
                    : "border-border-warm hover:bg-border-warm/20"
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

        <p className="mt-6 text-center text-sm text-ink/60">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-clay hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
