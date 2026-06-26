"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/src/store/authStore";
import Sidebar from "@/src/components/chat/sidebar/Sidebar";
import ChatArea from "@/src/components/chat/ChatArea";

// 🛡️ THE ORCHESTRATOR HOOKS (Complete Pipeline)
import { useChatInit } from "@/src/hooks/useChatInit"; // For Users/DMs
import { useWorkspaceInit } from "@/src/hooks/useWorkspaceInit"; // For Workspaces
import { useChannelFetcher } from "@/src/hooks/useChannelFetcher"; // For Channels
import { useChannelHistory } from "@/src/hooks/useChannelHistory"; // 🟢 THE AMNESIA FIX (History Fetcher)
import { useChatSocketEvents } from "@/src/hooks/useChatSocketEvents"; // For Real-time Engine
import { useWorkspaceMembers } from "@/src/hooks/useWorkspaceMembers";

export default function ChatPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // ==========================================
  // 🚀 THE DATA LIFECYCLE ENGINE
  // ==========================================
  useChatInit(); // Fetches Unread Counts
  useWorkspaceInit(); // Fetches Workspaces
  useWorkspaceMembers(); // 🟢 THE NEW ENGINE: Fetches team members for the active workspace
  useChannelFetcher(); // Fetches Channels
  useChannelHistory(); // Fetches history automatically
  useChatSocketEvents(); // Binds WebSockets

  useEffect(() => setMounted(true), []);

  // 🛡️ THE GATEKEEPER
  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [mounted, isAuthenticated, router]);

  if (!mounted) return null;
  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <ChatArea />
    </div>
  );
}
