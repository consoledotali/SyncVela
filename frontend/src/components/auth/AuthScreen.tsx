"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/src/store/authStore";
import { useAuthForm } from "@/src/hooks/useAuthForm";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
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
import { Eye, EyeOff, Loader2 } from "lucide-react";

// 🛡️ NAYA: Prop define karo taake pata chale yeh login page par khula hai ya signup par
export function AuthScreen({
  defaultMode,
}: {
  defaultMode: "login" | "signup";
}) {
  const { isAuthenticated, login } = useAuthStore();
  const router = useRouter();

  // Hook ko initial mode pass karo
  const isInitiallyLogin = defaultMode === "login";

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
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
  } = useAuthForm(isInitiallyLogin); // 🛡️ FIX: Hook ko initial state pass ki

  // 🛡️ NAYA: Ab state toggle nahi karni, proper page change karna hai
  const handleModeSwitch = () => {
    if (isLoginMode) {
      router.push("/auth/signup");
    } else {
      router.push("/auth/login");
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      const idToken = credentialResponse.credential;
      const res = await fetch("http://localhost:5000/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idToken }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Google Auth Failed");

      login(data.user, data.accessToken);
      router.push("/");
    } catch (err: any) {
      console.error("❌ Google Login Failed:", err.message);
    }
  };

  if (isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center items-center p-4">
      <Card className="w-full max-w-md shadow-lg border-zinc-200">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight text-zinc-900">
            {isLoginMode ? "Welcome back" : "Create an account"}
          </CardTitle>
          <CardDescription className="text-zinc-500">
            {isLoginMode
              ? "Enter your credentials to access your SyncVela workspace."
              : "Enter your details below to create your workspace."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-sm text-red-600 font-medium">
                {error}
              </div>
            )}

            {!isLoginMode && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="John Doe"
                  required={!isLoginMode}
                  value={formData.name}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  className="bg-white"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                required
                value={formData.email}
                onChange={handleInputChange}
                disabled={isLoading}
                className="bg-white"
              />
            </div>

            {/* Password Field with Forgot Password Link */}
            <div className="space-y-2 relative">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>

                {/* 🛡️ THE FIX: Forgot Password Link (Only in Login Mode) */}
                {isLoginMode && (
                  <button
                    type="button"
                    onClick={() => router.push("/auth/forgot-password")}
                    tabIndex={-1} // Taake tab dabane se direct input par jaye, idhar nahi
                    className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:underline transition-colors disabled:opacity-50"
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
                  className="bg-white pr-10"
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  disabled={isLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 focus:outline-none disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full mt-6" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                  Processing...
                </>
              ) : isLoginMode ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <div className="relative mt-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-zinc-50 px-2 text-zinc-500">
                Or continue with
              </span>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
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
              />
            </GoogleOAuthProvider>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4 border-t border-zinc-100 pt-6">
          <div className="text-center text-sm text-zinc-500">
            {isLoginMode
              ? "Don't have an account?"
              : "Already have an account?"}{" "}
            <button
              onClick={handleModeSwitch}
              disabled={isLoading}
              className="font-semibold text-zinc-900 hover:underline disabled:opacity-50"
            >
              {isLoginMode ? "Sign up" : "Log in"}
            </button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
