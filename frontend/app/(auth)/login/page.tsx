"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { ApiError } from "@/lib/api/client";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";

// useSearchParams() requires a Suspense boundary in the App Router or
// static prerendering fails at build time (confirmed via a real
// `npm run build` — this is not a lint nitpick, the build hard-errors
// without it). LoginForm holds all the real logic; the default export
// below just wraps it in Suspense so /login?email=...&registered=1
// (used by the register redirect) works without breaking the build.
function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const justRegistered = searchParams.get("registered") === "1";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      // authService.js's loginUser throws the same message for a wrong
      // email or a wrong password ("Invalid email or password") —
      // verified live — so there's nothing more specific to surface here.
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-semibold text-ink">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-ink/60">
            Sign in to your pantry
          </p>
        </div>

        {justRegistered && (
          <p className="mb-4 rounded-lg bg-sage/10 px-3 py-2 text-center text-sm text-sage">
            Account created. Sign in to continue.
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border-warm bg-white/60 p-6">
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <p role="alert" className="rounded-lg bg-brick/10 px-3 py-2 text-sm text-brick">
              {error}
            </p>
          )}

          <Button type="submit" loading={submitting} className="mt-2 w-full">
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink/60">
          New here?{" "}
          <Link href="/register" className="font-medium text-clay hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
