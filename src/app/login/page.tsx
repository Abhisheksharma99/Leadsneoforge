"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Zap, Loader2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-forge-bg-root)]">
      <div className="w-full max-w-md space-y-8">
        {/* Brand */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-forge-accent-muted)]">
            <Zap className="h-7 w-7 text-[var(--color-forge-accent)]" />
          </div>
          <div className="text-center">
            <h1
              className="text-2xl font-bold text-[var(--color-forge-text-primary)]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              LeadsNeoForge
            </h1>
            <p className="mt-1 text-sm text-[var(--color-forge-text-muted)]">
              AI-Powered Lead Generation & Marketing Automation
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="rounded-xl border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-surface)] p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium text-[var(--color-forge-text-secondary)]"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full rounded-lg border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-4 py-2.5 text-sm text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)] focus:border-[var(--color-forge-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-forge-accent)]"
                placeholder="admin@example.com"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-[var(--color-forge-text-secondary)]"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-4 py-2.5 text-sm text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)] focus:border-[var(--color-forge-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-forge-accent)]"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-forge-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-forge-bg-root)] transition-colors hover:bg-[var(--color-forge-accent-hover)] disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[var(--color-forge-text-muted)]">
          Credentials are configured via environment variables.
        </p>
      </div>
    </div>
  );
}
