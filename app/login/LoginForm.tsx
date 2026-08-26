"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Email/password sign-in form.
 *
 * On success we do NOT assume the user is done — a password-only session is
 * only `aal1`. We send them to the central `/auth/next` hub, which forwards to
 * MFA challenge, onboarding, or the portal depending on their state. A full
 * navigation (not client push) ensures the server re-reads the refreshed
 * session cookie.
 */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      // Deliberately generic: don't reveal whether the email exists.
      setError("Incorrect email or password.");
      setSubmitting(false);
      return;
    }

    // Let the server decide the next step (MFA / onboarding / portal).
    router.replace("/auth/next");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-off-white/80">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded border border-off-white/20 bg-asphalt-highlight px-3 py-2 text-off-white outline-none focus:border-racing-red"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-off-white/80">Password</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border border-off-white/20 bg-asphalt-highlight px-3 py-2 text-off-white outline-none focus:border-racing-red"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-racing-red">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded bg-racing-red px-4 py-2 font-semibold text-off-white disabled:opacity-60"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
