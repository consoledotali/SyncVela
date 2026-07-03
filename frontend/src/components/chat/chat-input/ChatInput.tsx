"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSocket } from "@/src/providers/SocketProvider";
import { useChatStore } from "@/src/store/chat";
import { useAuthStore } from "@/src/store/authStore";
import { useS3Upload } from "./useS3Upload";
import { AttachmentPreview } from "./AttachmentPreview";
import { Send, Paperclip, Loader2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

export default function ChatInput() {
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { socket } = useSocket();
  const { user } = useAuthStore();

  const {
    activeRoomId,
    activeChannelId,
    selectedUser,
    addPendingMessage,
    channels,
  } = useChatStore();

  const { uploadFile, isUploading } = useS3Upload();

  const isChannelView = !!activeChannelId;
  const isDMView = !!selectedUser;

  // 🟢 THE FIX: Store ki array mein se active channel ka object dhoondo
  const activeChannel = channels?.find((c) => c.id === activeChannelId);

  // ==========================================
  // ⌨️ TYPING ENGINE (WITH DEBOUNCE)
  // ==========================================
  const handleTyping = () => {
    if (!socket || !user || !isDMView || !selectedUser) return;

    socket.emit("typing", {
      roomId: activeRoomId,
      targetUserId: selectedUser.id,
      senderId: user.id,
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stopTyping", {
        roomId: activeRoomId,
        targetUserId: selectedUser.id,
        senderId: user.id,
      });
    }, 2000);
  };

  const handleStopTypingExplicit = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (!socket || !user || !isDMView || !selectedUser) return;

    socket.emit("stopTyping", {
      roomId: activeRoomId,
      targetUserId: selectedUser.id,
      senderId: user.id,
    });
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  // ==========================================
  // 📎 FILE VALIDATION
  // ==========================================
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
    ];
    if (!allowedTypes.includes(file.type)) {
      alert("❌ Invalid format!");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("❌ File is too large! Max 5MB.");
      return;
    }

    setAttachment(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ==========================================
  // 🚀 DISPATCH ENGINE
  // ==========================================
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && !attachment) || !socket || !user || isUploading)
      return;

    let attachmentUrl = null;

    if (attachment) {
      const uploadedUrl = await uploadFile(attachment);
      if (!uploadedUrl) return;
      attachmentUrl = uploadedUrl;
    }

    const tempId = uuidv4();
    const payload = {
      id: tempId,
      tempId,
      text: message.trim() || " ",
      senderId: user.id,
      attachmentUrl: attachmentUrl,
      createdAt: new Date().toISOString(),
      status: "pending" as const,
      sender: {
        id: user.id,
        name: user.name,
        avatarUrl: (user as any).avatarUrl || null,
      },
    };

    if (isChannelView && activeChannelId) {
      addPendingMessage(activeChannelId, "channel", payload);
      socket.emit("send_channel_message", {
        channelId: activeChannelId,
        ...payload,
      });
    } else if (isDMView && activeRoomId && selectedUser) {
      addPendingMessage(activeRoomId, selectedUser.id, payload);
      socket.emit("sendPrivateMessage", {
        roomId: activeRoomId,
        targetUserId: selectedUser.id,
        ...payload,
      });
    }

    setMessage("");
    setAttachment(null);
    handleStopTypingExplicit();
  };

  if (!isChannelView && !isDMView) return null;

  return (
    <div className="p-4 bg-background">
      <div className="relative flex flex-col bg-muted/30 border border-border rounded-xl focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all shadow-sm">
        {attachment && (
          <AttachmentPreview
            attachment={attachment}
            isUploading={isUploading}
            onRemove={() => setAttachment(null)}
          />
        )}

        <form onSubmit={handleSend} className="flex items-center gap-2 p-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          />

          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all shrink-0 disabled:opacity-50"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          <input
            type="text"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping();
            }}
            onBlur={handleStopTypingExplicit}
            // 🟢 THE FIX: Ab display mein raw ID nahi, actual channel ka naam aayega
            placeholder={
              isUploading
                ? "Uploading file..."
                : `Message ${isChannelView ? "#" + (activeChannel?.name || "channel") : selectedUser?.name}`
            }
            className="flex-1 bg-transparent border-none focus:outline-none px-2 py-2 text-[15px] placeholder:text-muted-foreground disabled:opacity-50"
            disabled={isUploading}
            autoComplete="off"
          />

          <button
            type="submit"
            disabled={(!message.trim() && !attachment) || isUploading}
            className="bg-primary hover:bg-primary/90 text-primary-foreground p-2.5 rounded-lg shadow-sm transition-all shrink-0 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed min-w-[40px]"
          >
            {isUploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5 ml-0.5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
