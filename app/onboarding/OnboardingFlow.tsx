"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PASSWORD_SET_FLAG } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 10;

type Step = "password" | "enroll" | "done";

type EnrollData = {
  factorId: string;
  qrCode: string;
  secret: string;
};

/**
 * Two-step first-login flow: set a permanent password, then enroll TOTP.
 *
 * The steps that actually run depend on what's outstanding (`needsPassword` /
 * `needsEnrollment`), so a user who, say, already set a password but never
 * finished MFA lands straight on enrollment.
 */
export function OnboardingFlow({
  needsPassword,
  needsEnrollment,
}: {
  needsPassword: boolean;
  needsEnrollment: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(
    needsPassword ? "password" : needsEnrollment ? "enroll" : "done",
  );

  const finish = useCallback(() => {
    setStep("done");
    router.replace("/auth/next");
    router.refresh();
  }, [router]);

  if (step === "password") {
    return (
      <PasswordStep
        onDone={() => setStep(needsEnrollment ? "enroll" : "done")}
      />
    );
  }

  if (step === "enroll") {
    return <EnrollStep onDone={finish} />;
  }

  return (
    <p className="mt-8 text-sm text-off-white/70">Finishing up…</p>
  );
}

function PasswordStep({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      // UX flag so we know the temporary password has been replaced. Not a
      // security boundary — writes are still gated by aal2 at the RLS layer.
      data: { [PASSWORD_SET_FLAG]: true },
    });

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
      <h2 className="font-heading text-lg font-bold text-off-white">
        1. Set a permanent password
      </h2>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-off-white/80">New password</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded border border-off-white/20 bg-asphalt-highlight px-3 py-2 text-off-white outline-none focus:border-racing-red"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-off-white/80">Confirm password</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
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
        {submitting ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}

function EnrollStep({ onDone }: { onDone: () => void }) {
  const [enroll, setEnroll] = useState<EnrollData | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Kick off enrollment once to get the QR code + secret. Any leftover
  // unverified factors from an abandoned attempt are cleared first so enroll
  // doesn't collide with them.
  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const { data: existing } = await supabase.auth.mfa.listFactors();
      const stale = (existing?.all ?? []).filter(
        (f) => f.status !== "verified",
      );
      await Promise.all(
        stale.map((f) => supabase.auth.mfa.unenroll({ factorId: f.id })),
      );

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
      });
      if (!active) return;
      if (enrollError || !data) {
        setError("Could not start MFA setup. Please refresh and try again.");
        return;
      }
      setEnroll({
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enroll) return;
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: enroll.factorId });
    if (challengeError || !challenge) {
      setError("Could not verify the code. Please try again.");
      setSubmitting(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enroll.factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (verifyError) {
      setError("That code didn't match. Please try again.");
      setSubmitting(false);
      return;
    }

    onDone();
  }

  return (
    <div className="mt-8 flex flex-col gap-4">
      <h2 className="font-heading text-lg font-bold text-off-white">
        2. Enroll two-factor authentication
      </h2>
      <p className="text-sm text-off-white/70">
        Scan this QR code with an authenticator app (Google Authenticator, 1Password,
        Authy…), then enter the 6-digit code it shows.
      </p>

      {!enroll && !error && (
        <p className="text-sm text-off-white/70">Preparing your QR code…</p>
      )}

      {enroll && (
        <>
          {/* qr_code is an SVG data URI generated by Supabase Auth. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enroll.qrCode}
            alt="TOTP QR code"
            className="h-48 w-48 self-center rounded bg-white p-2"
          />
          <p className="break-all text-center text-xs text-off-white/60">
            Can&apos;t scan? Enter this key manually:{" "}
            <code className="text-off-white/80">{enroll.secret}</code>
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

            <button
              type="submit"
              disabled={submitting || code.length < 6}
              className="rounded bg-racing-red px-4 py-2 font-semibold text-off-white disabled:opacity-60"
            >
              {submitting ? "Verifying…" : "Verify & finish"}
            </button>
          </form>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-racing-red">
          {error}
        </p>
      )}
    </div>
  );
}
