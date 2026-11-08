"use client";

import React, { useState } from "react";
import { authFetch } from "@/src/utils/apiClient";
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

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authFetch(`${API}/api/auth/set-password/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: otp.trim(), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to set password.");
      setUser({ hasPassword: true });
      setDone(true);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Failed to set password."));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>Password set successfully. You can now log in with email too.</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-3.5 space-y-2.5">
      <div className="flex items-start gap-2.5">
        <KeyRound className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-sidebar-foreground">
            Set account password
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            You signed in with Google. Add a password to enable email + password login.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-[11px] font-medium text-destructive">{error}</p>
      )}

      {step === "idle" && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={requestOtp}
          className="w-full text-xs h-8"
        >
          {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Send verification code to {user?.email}
        </Button>
      )}

      {step === "otp" && (
        <form onSubmit={submitOtp} className="space-y-2 pt-1">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              6-digit code
            </label>
            <input
              type="text"
              required
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="mt-1 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground tracking-widest focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            />
          </div>

          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              New password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="mt-1 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="submit"
              size="sm"
              disabled={loading || otp.length !== 6 || newPassword.length < 8}
              className="flex-1 text-xs h-8"
            >
              {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save password
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={loading}
              onClick={() => {
                setStep("idle");
                setError("");
              }}
              className="text-xs h-8"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

