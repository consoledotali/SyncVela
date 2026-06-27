"use client";

import React, { useState, useRef } from "react";
import { useSocket } from "@/src/providers/SocketProvider";
import { useChatStore } from "@/src/store/chat";
import { useAuthStore } from "@/src/store/authStore";
import {
  Send,
  Paperclip,
  X,
  FileText,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";

export default function ChatInput() {
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { socket } = useSocket();
  const { user, token } = useAuthStore();
  const { activeRoomId, activeChannelId, selectedUser, addPendingMessage } =
    useChatStore();

  const isChannelView = !!activeChannelId;
  const isDMView = !!selectedUser;

  // Typing indicator logic
  const handleTyping = () => {
    if (!socket || !user) return;
    if (isDMView && selectedUser) {
      socket.emit("typing", {
        roomId: activeRoomId,
        targetUserId: selectedUser.id,
        senderId: user.id,
      });
    }
  };

  const handleStopTyping = () => {
    if (!socket || !user) return;
    if (isDMView && selectedUser) {
      socket.emit("stopTyping", {
        roomId: activeRoomId,
        targetUserId: selectedUser.id,
        senderId: user.id,
      });
    }
  };

  // 🛡️ THE FILE SELECTION HANDLER
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict validation matching your backend ALLOWED_MIME_TYPES
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
    ];
    if (!allowedTypes.includes(file.type)) {
      alert(
        "❌ Invalid format! Only JPG, PNG, WEBP, GIF, and PDFs are allowed.",
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("❌ File is too large! Maximum allowed size is 5MB.");
      return;
    }

    setAttachment(file);
    if (fileInputRef.current) fileInputRef.current.value = ""; // Reset input
  };

  // 🚀 THE 2-STEP S3 UPLOAD ENGINE
  const uploadToS3 = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    try {
      // Step 1: Ask Backend for the Presigned Ticket
      const presignRes = await fetch(
        "http://localhost:5000/api/upload/presign",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ filename: file.name, contentType: file.type }),
        },
      );

      if (!presignRes.ok) throw new Error("Failed to get upload ticket");
      const { uploadUrl, finalFileUrl } = await presignRes.json();

      // Step 2: Upload directly to DigitalOcean Spaces
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type, "x-amz-acl": "public-read" },
        body: file,
      });

      if (!uploadRes.ok) throw new Error("Failed to upload to DigitalOcean");

      return finalFileUrl;
    } catch (error) {
      console.error("❌ S3 Upload Pipeline Failed:", error);
      alert("Failed to upload file. Please try again.");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  // 📤 THE MAIN SEND LOGIC
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && !attachment) || !socket || !user || isUploading)
      return;

    let attachmentUrl = null;

    // If there is an attachment, execute the S3 pipeline first
    if (attachment) {
      const uploadedUrl = await uploadToS3(attachment);
      if (!uploadedUrl) return; // Halt if upload fails
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
      socket.emit("sendMessage", {
        roomId: activeRoomId,
        targetUserId: selectedUser.id,
        message: payload,
      });
    }

    setMessage("");
    setAttachment(null);
    handleStopTyping();
  };

  if (!isChannelView && !isDMView) return null;

  return (
    <div className="p-4 bg-background border-t border-border mt-auto">
      {/* 🖼️ ATTACHMENT PREVIEW UI */}
      {attachment && (
        <div className="mb-3 flex items-center gap-3 p-3 bg-muted/50 rounded-xl border border-border w-max animate-in slide-in-from-bottom-2">
          <div className="p-2 bg-background rounded-lg shadow-sm border border-border flex items-center justify-center">
            {attachment.type.startsWith("image/") ? (
              <ImageIcon className="h-6 w-6 text-primary" />
            ) : (
              <FileText className="h-6 w-6 text-blue-500" />
            )}
          </div>
          <div className="flex flex-col max-w-[200px]">
            <span className="text-sm font-semibold truncate text-foreground">
              {attachment.name}
            </span>
            <span className="text-[10px] uppercase text-muted-foreground">
              {(attachment.size / 1024 / 1024).toFixed(2)} MB
            </span>
          </div>
          <button
            onClick={() => setAttachment(null)}
            disabled={isUploading}
            className="ml-2 p-1 hover:bg-destructive/10 hover:text-destructive text-muted-foreground rounded-full transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ⌨️ INPUT FIELD */}
      <form onSubmit={handleSend} className="flex items-end gap-2 relative">
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
          className="p-3 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all shrink-0 disabled:opacity-50"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        <div className="flex-1 bg-muted/50 border border-border rounded-2xl flex items-center focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all overflow-hidden min-h-[48px]">
          <input
            type="text"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping();
            }}
            onBlur={handleStopTyping}
            placeholder={
              isUploading
                ? "Uploading file..."
                : isChannelView
                  ? `Message #${activeChannelId}`
                  : `Message ${selectedUser?.name}`
            }
            className="w-full bg-transparent border-none focus:outline-none px-4 py-3 text-[15px] placeholder:text-muted-foreground disabled:opacity-50"
            disabled={isUploading}
          />
        </div>

        <button
          type="submit"
          disabled={(!message.trim() && !attachment) || isUploading}
          className="bg-primary hover:bg-primary/90 text-primary-foreground p-3 rounded-xl shadow-sm transition-all shrink-0 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed min-w-[48px]"
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5 ml-0.5" />
          )}
        </button>
      </form>
    </div>
  );
}
