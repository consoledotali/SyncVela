"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSocket } from "@/src/providers/SocketProvider";
import { useChatStore } from "@/src/store/chat";
import { useAuthStore } from "@/src/store/authStore";
import { useUploadStore } from "@/src/store/uploadStore";
import { Send, Paperclip } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

export default function ChatInput() {
  const { socket } = useSocket();
  const { user } = useAuthStore();
  const {
    activeRoomId,
    activeChannelId,
    selectedUser,
    channels,
  } = useChatStore();
  const { queueUpload, drafts, setDraft } = useUploadStore();

  const isChannelView = !!activeChannelId;
  const isDMView = !!selectedUser;
  const activeChannel = channels?.find((c) => c.id === activeChannelId);
  const chatId = activeChannelId || selectedUser?.id || "";

  const [message, setMessage] = useState(drafts[chatId] || "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Restore draft when switching chats
  useEffect(() => {
    setMessage(drafts[chatId] || "");
  }, [chatId]);

  const handleMessageChange = (val: string) => {
    setMessage(val);
    setDraft(chatId, val);
  };

  const handleTyping = () => {
    if (!socket || !user || !isDMView || !selectedUser) return;
    socket.emit("typing", { roomId: activeRoomId, targetUserId: selectedUser.id, senderId: user.id });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(
      () => socket.emit("stopTyping", { roomId: activeRoomId, targetUserId: selectedUser.id, senderId: user.id }),
      2000,
    );
  };

  const handleStopTypingExplicit = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (!socket || !user || !isDMView || !selectedUser) return;
    socket.emit("stopTyping", { roomId: activeRoomId, targetUserId: selectedUser.id, senderId: user.id });
  };

  useEffect(() => () => { if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current); }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const MAX_100_MB = 100 * 1024 * 1024;
    const valid = files.filter((f) => f.size <= MAX_100_MB);
    if (valid.length < files.length)
      alert("❌ Kuch files 100MB ki limit se bari theen, unhein ignore kar diya gaya.");

    if (!user) return;
    const sender = { id: user.id, name: user.name, avatarUrl: (user as any).avatarUrl || null };

    valid.forEach((file) => {
      queueUpload({
        id: uuidv4(),
        file,
        fileName: file.name,
        fileSize: file.size,
        progress: 0,
        status: "queued",
        channelId: activeChannelId || null,
        roomId: activeRoomId || null,
        targetUserId: selectedUser?.id || null,
        isChannel: isChannelView,
        text: message.trim(),
        sender,
        tempId: uuidv4(),
      });
    });

    handleMessageChange("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentText = message.trim();
    if (!currentText || !socket || !user) return;

    setMessage("");
    setDraft(chatId, "");

    const tempId = uuidv4();
    const basePayload = {
      id: tempId,
      tempId,
      text: currentText,
      senderId: user.id,
      createdAt: new Date().toISOString(),
      status: "pending" as const,
      attachments: [],
      sender: { id: user.id, name: user.name, avatarUrl: (user as any).avatarUrl || null },
    };

    const { addPendingMessage } = useChatStore.getState();

    if (isChannelView && activeChannelId) {
      addPendingMessage(activeChannelId, "channel", basePayload);
      socket.emit("send_channel_message", { channelId: activeChannelId, ...basePayload });
    } else if (isDMView && activeRoomId && selectedUser) {
      addPendingMessage(activeRoomId, selectedUser.id, basePayload);
      socket.emit("sendPrivateMessage", { roomId: activeRoomId, targetUserId: selectedUser.id, ...basePayload });
    }

    handleStopTypingExplicit();
  };

  if (!isChannelView && !isDMView) return null;

  return (
    <div className="p-4 bg-background">
      <div className="relative flex flex-col bg-muted/30 border border-border rounded-xl focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all shadow-sm">
        <form onSubmit={handleSend} className="flex items-center gap-2 p-2 relative z-20">
          <input type="file" multiple ref={fileInputRef} onChange={handleFileSelect} className="hidden" />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all shrink-0"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          <input
            type="text"
            value={message}
            onChange={(e) => { handleMessageChange(e.target.value); handleTyping(); }}
            onBlur={handleStopTypingExplicit}
            placeholder={`Message ${isChannelView ? "#" + (activeChannel?.name || "channel") : selectedUser?.name}`}
            className="flex-1 bg-transparent border-none focus:outline-none px-2 py-2 text-[15px] placeholder:text-muted-foreground"
            autoComplete="off"
          />

          <button
            type="submit"
            disabled={!message.trim()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground p-2.5 rounded-lg shadow-sm transition-all shrink-0 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed min-w-[40px]"
          >
            <Send className="h-5 w-5 ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
