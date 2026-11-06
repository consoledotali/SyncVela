"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { QueryProvider } from "@/src/providers/QueryProvider";
import { SocketProvider } from "@/src/providers/SocketProvider";
import { useAuthStore } from "@/src/store/authStore";
import WorkspaceHub from "@/src/features/chat/presentation/workspace/WorkspaceHub";
import { useWorkspaceInit } from "@/src/features/chat/runtime/workspace/useWorkspaceInit";
import { useChannelFetcher } from "@/src/features/chat/runtime/channels/useChannelFetcher";
import { useChannelHistory } from "@/src/features/chat/runtime/channels/useChannelHistory";
import { useChatSocketEvents } from "@/src/features/chat/runtime/realtime/useChatSocketEvents";
import { useWorkspaceMembers } from "@/src/features/chat/runtime/workspace/useWorkspaceMembers";

function WorkspaceRuntime() {
  useWorkspaceInit();
  useWorkspaceMembers();
  useChannelFetcher();
  useChannelHistory();
  useChatSocketEvents();

  return <WorkspaceHub />;
}

function WorkspacePage() {
  const { isAuthenticated, isSessionReady } = useAuthStore();
  const router = useRouter();
  useEffect(() => {
    if (isSessionReady && !isAuthenticated) router.replace("/auth/login");
  }, [isAuthenticated, isSessionReady, router]);

  if (!isSessionReady) {
    return (
      <main
        className="grid min-h-screen place-items-center bg-[#fbf7ed] text-[#172a45]"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="text-center">
          <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-[#b28a31]/25 border-t-[#b28a31]" />
          <p className="font-serif text-xl font-semibold">SyncVela</p>
          <p className="mt-1 text-sm text-[#756f64]">Loading your workspace securely…</p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#fbf7ed] px-6 text-[#172a45]">
        <section className="max-w-sm text-center" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#b28a31]">
            Secure workspace
          </p>
          <h1 className="mt-3 font-serif text-3xl font-semibold">Taking you to sign in</h1>
          <p className="mt-3 text-sm leading-6 text-[#756f64]">
            Your session is not active. We are redirecting you to continue securely.
          </p>
        </section>
      </main>
    );
  }

  return <WorkspaceRuntime />;
}

export default function ChatPage() {
  return (
    <QueryProvider>
      <SocketProvider>
        <WorkspacePage />
      </SocketProvider>
    </QueryProvider>
  );
}
