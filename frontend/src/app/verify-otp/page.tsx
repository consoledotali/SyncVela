"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function VerifyOtpRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const email = searchParams.get("email");
    const target = email
      ? `/auth/verify-otp?email=${encodeURIComponent(email)}`
      : "/auth/verify-otp";
    router.replace(target);
  }, [router, searchParams]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export default function VerifyOtpLegacyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyOtpRedirect />
    </Suspense>
  );
}
