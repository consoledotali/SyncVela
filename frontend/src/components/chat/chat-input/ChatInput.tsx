"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSocket } from "@/src/providers/SocketProvider";
import { useChatStore } from "@/src/store/chat";
import { useAuthStore } from "@/src/store/authStore";
import { useS3Upload } from "@/src/hooks/useS3Upload";
import { AttachmentPreview } from "./AttachmentPreview";
import { Send, Paperclip, Loader2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

export default function ChatInput() {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isBatchSending, setIsBatchSending] = useState(false);

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
  const { uploadFile } = useS3Upload(); // isUploading is handled locally via isBatchSending now

  const isChannelView = !!activeChannelId;
  const isDMView = !!selectedUser;
  const activeChannel = channels?.find((c) => c.id === activeChannelId);

  const handleTyping = () => {
    if (!socket || !user || !isDMView || !selectedUser) return;
    socket.emit("typing", {
      roomId: activeRoomId,
      targetUserId: selectedUser.id,
      senderId: user.id,
    });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(
      () =>
        socket.emit("stopTyping", {
          roomId: activeRoomId,
          targetUserId: selectedUser.id,
          senderId: user.id,
        }),
      2000,
    );
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const MAX_100_MB = 100 * 1024 * 1024;
    const validFiles = files.filter((f) => f.size <= MAX_100_MB);
    if (validFiles.length < files.length)
      alert(
        "❌ Kuch files 100MB ki limit se bari theen, unhein ignore kar diya gaya.",
      );
    setAttachments((prev) => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (indexToRemove: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      (!message.trim() && attachments.length === 0) ||
      !socket ||
      !user ||
      isBatchSending
    )
      return;

    setIsBatchSending(true);
    const currentText = message.trim();
    const currentAttachments = [...attachments];

    // 🚀 SLACK UI FIX: Fauran input box saaf kardo
    setMessage("");

    try {
      let uploadedAttachments: any[] = [];

      if (currentAttachments.length > 0) {
        const uploadPromises = currentAttachments.map((file) =>
          uploadFile(file),
        );
        const results = await Promise.all(uploadPromises);
        uploadedAttachments = results.filter((att) => att !== null);
      }

      const tempId = uuidv4();

      // Optimistic (local) attachments use a blob URL so the sender sees an
      // instant preview — the stored S3 url is private and would 403 in the
      // browser. The real signed url arrives when history is re-fetched.
      const localAttachments = uploadedAttachments.map((att, idx) => ({
        ...att,
        url: currentAttachments[idx]
          ? URL.createObjectURL(currentAttachments[idx])
          : att.url,
      }));

      const basePayload = {
        id: tempId,
        tempId,
        text: currentText || " ",
        senderId: user.id,
        createdAt: new Date().toISOString(),
        status: "pending" as const,
        sender: {
          id: user.id,
          name: user.name,
          avatarUrl: (user as any).avatarUrl || null,
        },
      };

      // Local store gets blob-preview attachments; socket gets the real S3 refs.
      const localPayload = { ...basePayload, attachments: localAttachments };
      const wirePayload = { ...basePayload, attachments: uploadedAttachments };

      if (isChannelView && activeChannelId) {
        addPendingMessage(activeChannelId, "channel", localPayload);
        socket.emit("send_channel_message", {
          channelId: activeChannelId,
          ...wirePayload,
        });
      } else if (isDMView && activeRoomId && selectedUser) {
        addPendingMessage(activeRoomId, selectedUser.id, localPayload);
        socket.emit("sendPrivateMessage", {
          roomId: activeRoomId,
          targetUserId: selectedUser.id,
          ...wirePayload,
        });
      }

      // Success ke baad file tray band kardo
      setAttachments([]);
    } finally {
      setIsBatchSending(false);
      handleStopTypingExplicit();
    }
  };

  if (!isChannelView && !isDMView) return null;
  const isSystemBusy = isBatchSending;

  return (
    <div className="p-4 bg-background">
      <div className="relative flex flex-col bg-muted/30 border border-border rounded-xl focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all shadow-sm">
        {/* 🟢 SLACK-STYLE ATTACHMENT TRAY WITHOUT GIANT BLUR OVERLAY */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 border-b border-border/50 bg-background/50 rounded-t-xl max-h-[180px] overflow-y-auto custom-scrollbar relative">
            {attachments.map((file, idx) => (
              <div
                key={idx}
                className={isSystemBusy ? "opacity-60 pointer-events-none" : ""}
              >
                {/* Loader logic is handled directly in AttachmentPreview visually */}
                <AttachmentPreview
                  attachment={file}
                  isUploading={isSystemBusy}
                  onRemove={() => removeAttachment(idx)}
                />
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 p-2 relative z-20"
        >
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            type="button"
            disabled={isSystemBusy}
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
            placeholder={`Message ${isChannelView ? "#" + (activeChannel?.name || "channel") : selectedUser?.name}`}
            className="flex-1 bg-transparent border-none focus:outline-none px-2 py-2 text-[15px] placeholder:text-muted-foreground disabled:opacity-50"
            disabled={isSystemBusy}
            autoComplete="off"
          />

          <button
            type="submit"
            disabled={
              (!message.trim() && attachments.length === 0) || isSystemBusy
            }
            className="bg-primary hover:bg-primary/90 text-primary-foreground p-2.5 rounded-lg shadow-sm transition-all shrink-0 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed min-w-[40px]"
          >
            {isSystemBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-5 w-5 ml-0.5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
