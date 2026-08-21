import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <p className="font-display text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          NutriCare
        </p>
        <p className="mt-3 text-base text-ink/70">
          Track your pantry, meals, and nutrition.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-full bg-clay px-6 text-sm font-medium text-white transition-colors hover:bg-clay/90"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="inline-flex h-11 items-center justify-center rounded-full border border-border-warm bg-white px-6 text-sm font-medium text-ink transition-colors hover:bg-paper"
          >
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}
