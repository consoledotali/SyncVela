"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useAuthStore } from "@/src/store/authStore";
import { useAuthForm } from "@/src/features/auth/session/useAuthForm";
import {
  GoogleOAuthProvider,
  GoogleLogin,
  type CredentialResponse,
} from "@react-oauth/google";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/src/components/ui/card";
import { Eye, EyeOff, Loader2, TriangleAlert } from "lucide-react";
import { consumeInviteDestination } from "@/src/features/auth/navigation/inviteContinuation";
import ThemeToggle from "@/src/shared/ui/ThemeToggle";

export function AuthScreen({
  defaultMode,
}: {
  defaultMode: "login" | "signup";
}) {
  const { isAuthenticated, login } = useAuthStore();
  const router = useRouter();
  const isInitiallyLogin = defaultMode === "login";
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  const hasGoogleClientId = Boolean(
    googleClientId && !googleClientId.startsWith("replace_with_"),
  );
  const [googleError, setGoogleError] = useState<string | null>(null);

  // ==========================================
  // 🚀 THE FIX: SMART REDIRECT ENGINE (Strictly sync with localStorage)
  // ==========================================
  useEffect(() => {
    if (isAuthenticated) {
      // 🛡️ THE BUG KILLER: Use the exact same key that InvitePage uses!
      const pendingInviteUrl = consumeInviteDestination();

      if (pendingInviteUrl) {
        // Invite link mil gaya! Cache saaf karo aur user ko uski manzil par bhejo
        router.replace(pendingInviteUrl);
      } else {
        // Normal login, seedha dashboard
        router.replace("/");
      }
    }
  }, [isAuthenticated, router]);

  const {
    isLoginMode,
    showPassword,
    formData,
    error,
    isLoading,
    togglePasswordVisibility,
    handleInputChange,
    handleSubmit,
  } = useAuthForm(isInitiallyLogin);

  const handleModeSwitch = () => {
    router.push(isLoginMode ? "/auth/signup" : "/auth/login");
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    setGoogleError(null);
    try {
      const idToken = credentialResponse.credential;
      if (!idToken) {
        throw new Error("Google did not return a valid identity credential.");
      }
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/auth/google`,
        { idToken },
        { withCredentials: true, validateStatus: () => true },
      );

      const data = res.data;
      if (res.status < 200 || res.status >= 300)
        throw new Error(data?.error || "Google Auth Failed");

      // Yeh state update trigger karega aur upar wala useEffect user ko theek jagah route kar dega
      login(data.user, data.accessToken);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Google sign-in failed.";
      setGoogleError(message);
    }
  };

  if (isAuthenticated) return null;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 text-foreground transition-colors">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(193,148,51,.13)_1px,transparent_1px),linear-gradient(to_bottom,rgba(193,148,51,.13)_1px,transparent_1px)] bg-[size:29px_29px] [mask-image:radial-gradient(ellipse_60%_56%_at_50%_38%,#000_52%,transparent_100%)]" />
      <div className="pointer-events-none absolute left-[10%] top-[12%] h-48 w-48 rounded-full border border-[#c19333]/25 before:absolute before:inset-0 before:rounded-full before:border before:border-[#c19333]/20 before:content-[''] before:translate-x-[45%] after:absolute after:inset-0 after:rounded-full after:border after:border-[#c19333]/20 after:content-[''] after:translate-y-[45%]" />
      <div className="pointer-events-none absolute bottom-[9%] right-[12%] h-32 w-32 rounded-full border border-[#c19333]/20" />

      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-[380px]">
        <div className="mb-4 text-center">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
            SyncVela
          </h1>
        </div>

        <Card className="overflow-hidden rounded-2xl border-border bg-card/95 shadow-xl shadow-primary/10 backdrop-blur-md">
          <CardHeader className="space-y-1 pb-4 text-center px-6 pt-6">
            <CardTitle className="text-xl font-semibold tracking-tight text-card-foreground">
              {isLoginMode ? "Welcome back" : "Create account"}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {isLoginMode
                ? "Enter your credentials below."
                : "Enter your details to get started."}
            </CardDescription>
          </CardHeader>

          <CardContent className="pb-5 px-6">
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/80 p-2.5 text-xs font-medium text-red-600">
                  <TriangleAlert className="h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              {!isLoginMode && (
                <div className="space-y-1">
                  <Label htmlFor="name" className="text-xs text-muted-foreground">
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="John Doe"
                    required={!isLoginMode}
                    value={formData.name}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="h-10 rounded-lg border-input bg-background/80 text-sm focus-visible:border-ring focus-visible:ring-ring"
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs text-muted-foreground">
                  Work Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@company.com"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  className="h-10 rounded-lg border-input bg-background/80 text-sm focus-visible:border-ring focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-1 relative">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs text-muted-foreground">
                    Password
                  </Label>
                  {isLoginMode && (
                    <button
                      type="button"
                      onClick={() => router.push("/auth/forgot-password")}
                      tabIndex={-1}
                      className="text-[11px] font-medium text-primary transition-colors hover:text-primary/80 hover:underline disabled:opacity-50"
                      disabled={isLoading}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="h-10 rounded-lg border-input bg-background/80 pr-10 text-sm focus-visible:border-ring focus-visible:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    disabled={isLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus:outline-none disabled:opacity-50"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="mt-1 h-10 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 active:scale-[.98]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                    Processing...
                  </>
                ) : isLoginMode ? (
                  "Sign In"
                ) : (
                  "Continue with Email"
                )}
              </Button>
            </form>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-medium">
                <span className="bg-card px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <div className="flex min-h-10 w-full items-center justify-center">
              {hasGoogleClientId && googleClientId ? (
                <GoogleOAuthProvider clientId={googleClientId}>
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() =>
                      setGoogleError("Google sign-in was cancelled or could not be completed.")
                    }
                    theme="outline"
                    size="large"
                    width="280"
                    text="continue_with"
                    shape="rectangular"
                    logo_alignment="center"
                  />
                </GoogleOAuthProvider>
              ) : (
                <p className="text-center text-xs text-muted-foreground">
                  Google sign-in is unavailable until the public client ID is configured.
                </p>
              )}
            </div>
            {googleError && (
              <p role="alert" className="mt-2 text-center text-xs font-medium text-red-600">
                {googleError}
              </p>
            )}
          </CardContent>

          <CardFooter className="flex flex-col border-t border-border bg-muted/40 px-6 py-4">
            <div className="text-center text-xs text-muted-foreground">
              {isLoginMode
                ? "Don't have an account?"
                : "Already have an account?"}{" "}
              <button
                onClick={handleModeSwitch}
                disabled={isLoading}
                className="font-semibold text-primary transition-all hover:text-primary/80 hover:underline disabled:opacity-50"
              >
                {isLoginMode ? "Sign up" : "Log in"}
              </button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
