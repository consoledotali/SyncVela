"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/src/store/authStore";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/src/components/ui/card";
import { Loader2, MailOpen, ShieldAlert } from "lucide-react";

function VerifyOTPContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!email) {
      router.push("/auth/login");
    }
  }, [email, router]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError("OTP must be exactly 6 digits.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:5000/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, otp }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");

      const { login } = useAuthStore.getState();
      login(data.user, data.accessToken);
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-zinc-50 flex flex-col justify-center items-center p-4 overflow-hidden">
      {/* Subtle Enterprise Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <Card className="relative w-full max-w-md shadow-xl border-zinc-200/60 bg-white/80 backdrop-blur-sm">
        <CardHeader className="space-y-4 text-center pb-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 shadow-sm ring-1 ring-zinc-900/5">
            <MailOpen className="h-7 w-7 text-white" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold tracking-tight text-zinc-900">
              Check your email
            </CardTitle>
            <CardDescription className="text-sm text-zinc-500">
              We sent a 6-digit secure code to <br />
              <span className="font-medium text-zinc-900">{email}</span>
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleVerify} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50/80 border border-red-200 rounded-lg text-sm text-red-600 font-medium">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="000000"
                disabled={isLoading}
                className="text-center text-4xl tracking-[0.75em] font-mono h-20 bg-zinc-50/50 border-zinc-200 shadow-inner focus-visible:ring-zinc-900 transition-all rounded-xl"
                autoFocus
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-[15px] font-semibold bg-zinc-900 hover:bg-zinc-800 text-white transition-all rounded-lg"
              disabled={isLoading || otp.length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Verifying...
                </>
              ) : (
                "Verify Securely"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyOTPPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      }
    >
      <VerifyOTPContent />
    </Suspense>
  );
}
