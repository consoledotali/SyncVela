"use client";

import React, { useState } from "react";
import { authFetch } from "@/src/lib/authFetch";
import { useAuthStore } from "@/src/store/authStore";
import { Button } from "@/src/components/ui/button";
import { KeyRound, Loader2, CheckCircle2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function SetPasswordCard() {
  const { user } = useAuthStore();
  const setUser = (patch: Partial<NonNullable<typeof user>>) => {
    const s = useAuthStore.getState();
    if (s.user) useAuthStore.setState({ user: { ...s.user, ...patch } });
  };

  const [step, setStep] = useState<"idle" | "otp">("idle");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // This onboarding applies only to accounts created through Google without a
  // local password. Missing/partial profile state must never classify a local
  // account as Google-only.
  const isGoogleOnlyAccount = user?.provider === "GOOGLE" && user.hasPassword === false;

  if (!isGoogleOnlyAccount && !done) return null;

  const requestOtp = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await authFetch(`${API}/api/auth/set-password/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code.");
      setStep("otp");
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to send code."));
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    setError("");
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch(`${API}/api/auth/set-password/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to set password.");

      // 🚀 STATE UPDATE: Yeh Zustand store ko update karega aur agli dafa yeh component automatically hide ho jayega
      setDone(true);
      setUser({ hasPassword: true });
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to set password."));
    } finally {
      setLoading(false);
    }
  };

  // Jab successfully password set ho jaye, toh confirmation dikhao (agle reload par yeh section gayab ho jayega)
  if (done) {
    return (
      <div className="w-full flex items-center gap-2 text-sm text-green-600 bg-green-500/10 rounded-lg px-3 py-3 border border-green-200">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        <span className="font-medium">
          Password set successfully! You can now log in with email and password.
        </span>
      </div>
    );
  }

  return (
    <div className="w-full border border-border rounded-lg p-5 flex flex-col gap-3 bg-muted/10">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-primary" />
        <h4 className="text-[15px] font-bold text-foreground">
          Set a password
        </h4>
      </div>
      <p className="text-xs text-muted-foreground -mt-1 mb-2">
        Your account currently uses Google Sign-In exclusively. Set a password
        here if you also want the option to log in using your email and
        password.
      </p>

      {error && (
        <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 font-medium">
          {error}
        </p>
      )}

      {step === "idle" ? (
        <Button
          size="sm"
          onClick={requestOtp}
          disabled={loading}
          className="w-full sm:w-auto mt-1 font-semibold"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Send verification code to email
        </Button>
      ) : (
        <div className="flex flex-col gap-3 mt-2">
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Verification Code
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit code from your email"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <Button
            size="sm"
            onClick={confirm}
            disabled={loading || otp.length !== 6 || newPassword.length < 6}
            className="w-full mt-2 font-semibold"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Confirm & Set Password"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
