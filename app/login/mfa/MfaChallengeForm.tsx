"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * TOTP challenge form. On submit it looks up the user's verified factor,
 * opens a challenge, and verifies the entered code. A successful verify
 * upgrades the session cookie to `aal2`; we then hand off to `/auth/next`.
 */
export function MfaChallengeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const supabase = createClient();

    const { data: factors, error: listError } =
      await supabase.auth.mfa.listFactors();
    const factor = factors?.totp?.[0];
    if (listError || !factor) {
      setError("No authenticator is enrolled. Please restart sign-in.");
      setSubmitting(false);
      return;
    }

    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (challengeError || !challenge) {
      setError("Could not start verification. Please try again.");
      setSubmitting(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (verifyError) {
      setError("That code didn't match. Please try again.");
      setSubmitting(false);
      return;
    }

    router.replace("/auth/next");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-off-white/80">Authentication code</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="rounded border border-off-white/20 bg-asphalt-highlight px-3 py-2 tracking-[0.5em] text-off-white outline-none focus:border-racing-red"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-racing-red">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || code.length < 6}
        className="mt-2 rounded bg-racing-red px-4 py-2 font-semibold text-off-white disabled:opacity-60"
      >
        {submitting ? "Verifying…" : "Verify"}
      </button>
    </form>
  );
}
