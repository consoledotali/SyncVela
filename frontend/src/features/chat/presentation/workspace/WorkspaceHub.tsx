"use client";

import ChatArea from "../conversation/ChatArea";
import Sidebar from "../sidebar/Sidebar";

/**
 * SyncVela's authenticated product surface is intentionally chat-first.
 * Channels, direct messages, threads, reactions, typing indicators, unread
 * state, and attachments remain owned by the chat feature and its secure
 * Socket.IO plus REST boundaries.
 */
export default function WorkspaceHub() {
  return (
    <main className="flex min-h-[100dvh] min-w-0 overflow-hidden bg-background text-foreground transition-colors">
      <Sidebar />
      <ChatArea />
    </main>
  );
}
