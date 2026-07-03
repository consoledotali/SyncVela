"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/src/store/authStore";
import { Button } from "@/src/components/ui/button";
import { Shield, Loader2, AlertCircle, ArrowRight } from "lucide-react";

function VerifyOTPContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // 🟢 THE TIMER STATE
  const [timeLeft, setTimeLeft] = useState(60);
  const [isResending, setIsResending] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!email) {
      router.push("/auth/login");
    }
  }, [email, router]);

  // 🟢 ACTUAL TIMER COUNTDOWN LOGIC
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleChange = (element: HTMLInputElement, index: number) => {
    if (isNaN(Number(element.value))) return;

    const newOtp = [...otp];
    newOtp[index] = element.value;
    setOtp(newOtp);
    setError("");

    if (element.value !== "" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (e.key === "Backspace") {
      if (otp[index] === "" && index > 0) {
        inputRefs.current[index - 1]?.focus();
      } else {
        const newOtp = [...otp];
        newOtp[index] = "";
        setOtp(newOtp);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6).split("");

    if (pastedData.some((char) => isNaN(Number(char)))) return;

    const newOtp = [...otp];
    pastedData.forEach((char, i) => {
      if (i < 6) newOtp[i] = char;
    });

    setOtp(newOtp);

    const focusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  // 🟢 API HIT FOR RESEND OTP
  const handleResend = async () => {
    if (timeLeft > 0 || isResending) return;
    setIsResending(true);
    setError("");

    try {
      const res = await fetch("http://localhost:5000/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to resend code.");
      }

      setTimeLeft(60); // Timer Wapas 60s par
      setOtp(new Array(6).fill("")); // Inputs khali
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsResending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpString = otp.join("");

    if (otpString.length !== 6) {
      setError("Please enter all 6 digits.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:5000/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, otp: otpString }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid verification code.");

      const { login } = useAuthStore.getState();
      login(data.user, data.accessToken);

      const pendingInvite = localStorage.getItem("pendingInvite");
      if (pendingInvite) {
        localStorage.removeItem("pendingInvite");
        router.push(pendingInvite);
      } else {
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message);
      setOtp(new Array(6).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-[0px_0px_1px_rgba(0,0,0,0.1),0px_8px_16px_rgba(0,0,0,0.05)] border border-zinc-100 p-8 sm:p-10">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 bg-zinc-100 rounded-xl flex items-center justify-center mb-5 border border-zinc-200">
            <Shield className="h-6 w-6 text-zinc-900" />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">
            Authenticate
          </h1>
          <p className="text-sm text-zinc-500 text-center leading-relaxed">
            We've sent a 6-digit secure code to <br />
            <span className="font-semibold text-zinc-900">{email}</span>
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-6">
          <div className="flex justify-between gap-2 sm:gap-3">
            {otp.map((data, index) => (
              <input
                key={index}
                type="text"
                inputMode="numeric"
                maxLength={1}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                value={data}
                onChange={(e) => handleChange(e.target, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onPaste={handlePaste}
                disabled={isLoading}
                className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-semibold bg-white border border-zinc-300 rounded-lg text-zinc-900 focus:bg-zinc-50 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:outline-none transition-all disabled:opacity-50 select-none"
              />
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-100 animate-in slide-in-from-top-1 fade-in duration-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading || otp.join("").length !== 6}
            className="w-full h-12 text-[15px] font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition-all rounded-lg mt-4 group"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <div className="flex items-center gap-2">
                Verify Account
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            )}
          </Button>

          {/* 🟢 THE DYNAMIC RESEND BUTTON */}
          <p className="text-xs text-center text-zinc-500 mt-6 flex flex-col sm:flex-row items-center justify-center gap-1">
            <span>Didn't receive the code?</span>
            <button
              type="button"
              disabled={timeLeft > 0 || isResending}
              onClick={handleResend}
              className={`font-semibold transition-all ${
                timeLeft > 0 || isResending
                  ? "text-zinc-400 cursor-not-allowed"
                  : "text-zinc-900 hover:underline"
              }`}
            >
              {isResending
                ? "Sending..."
                : timeLeft > 0
                  ? `Resend in ${timeLeft}s`
                  : "Click to resend"}
            </button>
          </p>
        </form>
      </div>
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
