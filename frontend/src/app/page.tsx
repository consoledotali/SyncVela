"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/src/store/authStore";
import Sidebar from "@/src/components/chat/Sidebar";
import ChatArea from "@/src/components/chat/ChatArea";

// The Orchestrator Hooks
import { useChatInit } from "@/src/hooks/useChatInit";
import { useChatSocketEvents } from "@/src/hooks/useChatSocketEvents";

export default function ChatPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Initialize Data & Bind Socket Events
  useChatInit();
  useChatSocketEvents();

  useEffect(() => setMounted(true), []);

  // 🛡️ THE GATEKEEPER: Agar auth nahi hai toh seedha /login par phaink do
  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.push("/login");
    }
  }, [mounted, isAuthenticated, router]);

  if (!mounted) return null;
  if (!isAuthenticated) return null; // Extra guard to prevent flicker during redirect

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <ChatArea />
    </div>
  );
}
