"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { ArrowLeft, Loader2, MailCheck, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { useAuthStore } from "@/src/store/authStore";
import {
  isValidOtp,
  maskEmail,
  normalizeOtp,
  verifyOtpSession,
} from "@/src/utils/otpUtils";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const RESEND_COOLDOWN_SECONDS = 60;

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((state) => state.login);
  const email = searchParams.get("email")?.trim() ?? "";
  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [secondsUntilResend, setSecondsUntilResend] = useState(0);

  useEffect(() => {
    if (secondsUntilResend <= 0) return;

    const timer = window.setInterval(() => {
      setSecondsUntilResend((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [secondsUntilResend]);

  const emailLabel = useMemo(() => maskEmail(email), [email]);

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!email) {
      setError("Your sign-up email is missing. Please return to sign up and try again.");
      return;
    }

    if (!isValidOtp(otp)) {
      setError("Enter the complete 6-digit verification code.");
      return;
    }

    setIsVerifying(true);

    try {
      const destination = await verifyOtpSession({
        apiUrl,
        email,
        otp,
        request: (url, payload) => axios.post(url, payload, { withCredentials: true, validateStatus: () => true }),
        onAuthenticated: login,
      });
      router.replace(destination);
    } catch (verificationError: unknown) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "We could not verify that code. Please try again.",
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email || isResending || secondsUntilResend > 0) return;

    setError("");
    setNotice("");
    setIsResending(true);

    try {
      const response = await axios.post(
        `${apiUrl}/api/auth/resend-otp`,
        { email },
        { withCredentials: true, validateStatus: () => true },
      );
      const data = response.data;

      if (response.status < 200 || response.status >= 300) {
        throw new Error(data?.error || "We could not resend the code. Please try again.");
      }

      setNotice("A fresh verification code has been sent. Check your inbox and spam folder.");
      setSecondsUntilResend(RESEND_COOLDOWN_SECONDS);
    } catch (resendError: unknown) {
      setError(
        resendError instanceof Error
          ? resendError.message
          : "We could not resend the code. Please try again.",
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fffaf0] p-4">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(193,148,51,.13)_1px,transparent_1px),linear-gradient(to_bottom,rgba(193,148,51,.13)_1px,transparent_1px)] bg-[size:29px_29px] [mask-image:radial-gradient(ellipse_60%_56%_at_50%_38%,#000_52%,transparent_100%)]" />
      <div className="pointer-events-none absolute left-[10%] top-[12%] h-48 w-48 rounded-full border border-[#c19333]/25 before:absolute before:inset-0 before:rounded-full before:border before:border-[#c19333]/20 before:content-[''] before:translate-x-[45%] after:absolute after:inset-0 after:rounded-full after:border after:border-[#c19333]/20 after:content-[''] after:translate-y-[45%]" />
      <div className="pointer-events-none absolute bottom-[9%] right-[12%] h-32 w-32 rounded-full border border-[#c19333]/20" />

      <section className="relative z-10 w-full max-w-[400px]">
        <div className="mb-4 text-center">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.25em] text-[#a47618]">Secure account activation</p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-[#142641]">SyncVela</h1>
        </div>

        <Card className="overflow-hidden rounded-2xl border-[#e2c984] bg-[#fffdf8]/95 shadow-[0_24px_70px_rgba(24,45,73,.13)] backdrop-blur-md">
          <CardHeader className="space-y-2 px-6 pb-4 pt-6 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-[#e2c984] bg-[#fcf5e6] text-[#9a741f]">
              <MailCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle className="text-xl font-semibold tracking-tight text-[#142641]">Verify your email</CardTitle>
            <CardDescription className="text-xs leading-5 text-[#777167]">
              {email
                ? <>We sent a 6-digit code to <span className="font-semibold text-[#465066]">{emailLabel}</span>.</>
                : "Your verification link is missing the email address. Return to sign up to request a new code."}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pb-5">
            {error ? (
              <div role="alert" className="mb-4 flex gap-2 rounded-lg border border-red-200 bg-red-50/80 p-2.5 text-xs font-medium text-red-600">
                <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                <p>{error}</p>
              </div>
            ) : null}
            {notice ? (
              <div role="status" className="mb-4 flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 p-2.5 text-xs font-medium text-emerald-700">
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                <p>{notice}</p>
              </div>
            ) : null}

            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="otp" className="text-xs text-[#465066]">6-digit verification code</Label>
                <Input
                  id="otp"
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(event) => setOtp(normalizeOtp(event.target.value))}
                  disabled={!email || isVerifying}
                  className="h-12 rounded-lg border-[#dfd0b4] bg-white/80 text-center font-mono text-lg font-bold tracking-[0.42em] text-[#142641] placeholder:tracking-[0.35em] focus-visible:border-[#bd8d2c] focus-visible:ring-[#ead49e]"
                  aria-describedby="otp-help"
                />
                <p id="otp-help" className="text-[11px] text-[#8b8375]">The code expires after 10 minutes.</p>
              </div>

              <Button
                type="submit"
                disabled={!email || !isValidOtp(otp) || isVerifying}
                className="h-10 w-full rounded-lg bg-[#173050] text-sm font-semibold text-[#fff7df] transition-all hover:bg-[#254268] active:scale-[.98]"
              >
                {isVerifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : "Verify & enter workspace"}
              </Button>
            </form>

            <div className="mt-5 border-t border-[#e7dcc5] pt-4 text-center">
              <p className="text-xs text-[#777167]">Didn&apos;t receive the code?</p>
              <Button
                type="button"
                variant="ghost"
                disabled={!email || isResending || secondsUntilResend > 0}
                onClick={handleResend}
                className="mt-1 h-8 px-2 text-xs font-semibold text-[#8d6617] hover:bg-[#fcf5e6] hover:text-[#142641]"
              >
                {isResending ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Sending...</> : secondsUntilResend > 0 ? `Resend code in ${secondsUntilResend}s` : <><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Resend code</>}
              </Button>
            </div>
          </CardContent>

          <CardFooter className="border-t border-[#e7dcc5] bg-[#fcf5e6]/70 px-6 py-4">
            <Link href="/auth/signup" className="mx-auto inline-flex items-center text-xs font-semibold text-[#8d6617] transition-colors hover:text-[#142641] hover:underline">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Back to sign up
            </Link>
          </CardFooter>
        </Card>
      </section>
    </main>
  );
}

function VerifyOtpLoadingState() {
  return <main className="min-h-screen bg-[#fffaf0]" aria-label="Loading email verification" />;
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<VerifyOtpLoadingState />}>
      <VerifyOtpContent />
    </Suspense>
  );
}
