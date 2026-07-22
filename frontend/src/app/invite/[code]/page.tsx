"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/src/store/authStore";
import { Loader2, ShieldCheck, XCircle, UserCheck } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { authFetch } from "@/src/lib/authFetch";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, token } = useAuthStore();

  const [status, setStatus] = useState<
    "loading" | "success" | "already_member" | "error"
  >("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const inviteCode = params.code as string;
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      localStorage.setItem("pendingInvite", `/invite/${inviteCode}`);
      router.push("/auth/login");
      return;
    }

    if (hasFetched.current) return;
    hasFetched.current = true;

    const joinWorkspace = async () => {
      try {
        const response = await authFetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/workspaces/join/${inviteCode}`,
          {
            method: "POST",
          },
        );

        if (response.ok) {
          const data = await response.json();
          setStatus("success");

          // 🚀 THE ACTIVE WORKSPACE OVERRIDE FIX
          // Jab join ho jaye, toh aggressively local storage update kar do
          // taake useWorkspaceInit isay pick kar le.
          if (data.workspaceId) {
            localStorage.setItem("lastActiveWorkspaceId", data.workspaceId);
          }

          setTimeout(() => {
            window.location.href = "/";
          }, 1500);
        } else {
          const err = await response.json();

          if (err.error === "You are already in this workspace.") {
            setStatus("already_member");

            // 🚀 Force selection if they are already a member
            if (err.workspaceId) {
              localStorage.setItem("lastActiveWorkspaceId", err.workspaceId);
            }

            setTimeout(() => {
              window.location.href = "/";
            }, 1500);
          } else {
            setErrorMessage(
              err.error || "Failed to join workspace. Invalid or expired link.",
            );
            setStatus("error");
          }
        }
      } catch (error) {
        setErrorMessage(
          "Network error. Could not connect to SyncVela servers.",
        );
        setStatus("error");
      }
    };

    joinWorkspace();
  }, [inviteCode, isAuthenticated, token, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-lg border border-gray-100 text-center">
        {status === "loading" && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Joining Workspace...
            </h1>
            <p className="text-gray-500">
              Securing your connection to the team.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <div className="h-16 w-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-6">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Access Granted!
            </h1>
            <p className="text-gray-500">Redirecting you to the workspace...</p>
          </div>
        )}

        {status === "already_member" && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <div className="h-16 w-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6">
              <UserCheck className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome Back!
            </h1>
            <p className="text-gray-500">
              You are already part of this team. Taking you there...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <div className="h-16 w-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-6">
              <XCircle className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Access Denied
            </h1>
            <p className="text-red-500 mb-6">{errorMessage}</p>
            <Button onClick={() => router.push("/")} className="w-full">
              Return to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
