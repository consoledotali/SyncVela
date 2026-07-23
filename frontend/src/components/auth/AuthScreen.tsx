"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useAuthStore } from "@/src/store/authStore";
import { useAuthForm } from "@/src/hooks/useAuthForm";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
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

export function AuthScreen({
  defaultMode,
}: {
  defaultMode: "login" | "signup";
}) {
  const { isAuthenticated, login } = useAuthStore();
  const router = useRouter();
  const isInitiallyLogin = defaultMode === "login";

  // ==========================================
  // 🚀 THE FIX: SMART REDIRECT ENGINE (Strictly sync with localStorage)
  // ==========================================
  useEffect(() => {
    if (isAuthenticated) {
      // 🛡️ THE BUG KILLER: Use the exact same key that InvitePage uses!
      const pendingInviteUrl = localStorage.getItem("pendingInvite");

      if (pendingInviteUrl) {
        // Invite link mil gaya! Cache saaf karo aur user ko uski manzil par bhejo
        localStorage.removeItem("pendingInvite");
        router.push(pendingInviteUrl);
      } else {
        // Normal login, seedha dashboard
        router.push("/");
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

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      const idToken = credentialResponse.credential;
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
    } catch (err: any) {
      console.error("❌ Google Login Failed:", err.message);
    }
  };

  if (isAuthenticated) return null;

  return (
    <div className="relative min-h-screen bg-zinc-50 flex flex-col justify-center items-center p-4 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="relative z-10 w-full max-w-[380px]">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            SyncVela
          </h1>
        </div>

        <Card className="shadow-lg border-zinc-200/60 bg-white/90 backdrop-blur-md rounded-xl overflow-hidden">
          <CardHeader className="space-y-1 pb-4 text-center px-6 pt-6">
            <CardTitle className="text-xl font-bold tracking-tight text-zinc-900">
              {isLoginMode ? "Welcome back" : "Create account"}
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500">
              {isLoginMode
                ? "Enter your credentials below."
                : "Enter your details to get started."}
            </CardDescription>
          </CardHeader>

          <CardContent className="pb-5 px-6">
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {error && (
                <div className="flex items-center gap-2 p-2.5 bg-red-50/80 border border-red-200 rounded-lg text-xs text-red-600 font-medium">
                  <TriangleAlert className="h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              {!isLoginMode && (
                <div className="space-y-1">
                  <Label htmlFor="name" className="text-xs text-zinc-700">
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
                    className="bg-white/50 focus-visible:ring-zinc-900 rounded-lg h-10 text-sm"
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs text-zinc-700">
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
                  className="bg-white/50 focus-visible:ring-zinc-900 rounded-lg h-10 text-sm"
                />
              </div>

              <div className="space-y-1 relative">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs text-zinc-700">
                    Password
                  </Label>
                  {isLoginMode && (
                    <button
                      type="button"
                      onClick={() => router.push("/auth/forgot-password")}
                      tabIndex={-1}
                      className="text-[11px] font-medium text-zinc-500 hover:text-zinc-900 hover:underline transition-colors disabled:opacity-50"
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
                    className="bg-white/50 focus-visible:ring-zinc-900 rounded-lg h-10 pr-10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    disabled={isLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 focus:outline-none disabled:opacity-50 transition-colors"
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
                className="w-full h-10 mt-1 font-semibold bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg transition-all text-sm"
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
                <span className="w-full border-t border-zinc-200" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-medium">
                <span className="bg-white px-2 text-zinc-400">Or</span>
              </div>
            </div>

            <div className="flex justify-center">
              <GoogleOAuthProvider
                clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}
              >
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => console.error("❌ Google UI Popup Failed")}
                  theme="outline"
                  size="large"
                  width="100%"
                  text={isLoginMode ? "signin_with" : "signup_with"}
                  shape="rectangular"
                  logo_alignment="center"
                />
              </GoogleOAuthProvider>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col border-t border-zinc-100 bg-zinc-50/50 py-4 px-6">
            <div className="text-center text-xs text-zinc-500">
              {isLoginMode
                ? "Don't have an account?"
                : "Already have an account?"}{" "}
              <button
                onClick={handleModeSwitch}
                disabled={isLoading}
                className="font-semibold text-zinc-900 hover:underline disabled:opacity-50 transition-all"
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

