"use client";

import ChatArea from "@/src/components/chat/ChatArea";
import Sidebar from "./Sidebar";

export default function WorkspaceHub() {
  return (
    <main className="flex min-h-[100dvh] min-w-0 overflow-hidden bg-background text-foreground transition-colors">
      <Sidebar />
      <ChatArea />
    </main>
  );
}

