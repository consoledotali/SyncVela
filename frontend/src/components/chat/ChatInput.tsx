"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSocket } from "@/src/providers/SocketProvider";
import { useChatStore } from "@/src/store/chatStore";
import { useAuthStore } from "@/src/store/authStore";
import { useS3Upload } from "@/src/hooks/useS3Upload";
import {
  channelIdPayloadSchema,
  channelMessagePayloadSchema,
  directMessagePayloadSchema,
  roomIdPayloadSchema,
} from "@/src/utils/socketUtils";
import { AttachmentPreview } from "./AttachmentPreview";
import { Send, Paperclip, Loader2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";

const MAX_TOTAL_ATTACHMENT_BYTES = 100 * 1024 * 1024;
const MAX_ATTACHMENT_COUNT = 50;

const formatMegabytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);

type AuthenticatedChatUser = {
  id: string;
  name: string;
  avatarUrl?: string | null;
};

export default function ChatInput() {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
  const [isBatchSending, setIsBatchSending] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const lastTypingStartRef = useRef(0);

  const { socket } = useSocket();
  const { user } = useAuthStore();
  const {
    activeRoomId,
    activeChannelId,
    activeWorkspaceId,
    selectedUser,
    addPendingMessage,
    channels,
  } = useChatStore();

  const { uploadFile } = useS3Upload();

  const isChannelView = !!activeChannelId;
  const isDMView = !!selectedUser;
  const activeChannel = channels?.find((c) => c.id === activeChannelId);

  const emitTypingEvent = (isStopping: boolean) => {
    if (!socket || !user) return;

    if (isChannelView && activeChannelId) {
      const payload = channelIdPayloadSchema.safeParse({ channelId: activeChannelId });
      if (payload.success) {
        socket.emit(isStopping ? "channel_stop_typing" : "channel_typing", payload.data);
      }
      return;
    }

    if (!isDMView || !selectedUser) return;
    const payload = roomIdPayloadSchema.safeParse({ roomId: activeRoomId });
    if (!payload.success) return;
    socket.emit(isStopping ? "stopTyping" : "typing", payload.data);
  };

  const handleTyping = () => {
    const now = Date.now();
    if (!isTypingRef.current || now - lastTypingStartRef.current >= 1_200) {
      emitTypingEvent(false);
      isTypingRef.current = true;
      lastTypingStartRef.current = now;
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(
      () => {
        emitTypingEvent(true);
        isTypingRef.current = false;
        lastTypingStartRef.current = 0;
      },
      2000,
    );
  };

  const handleStopTypingExplicit = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (!isTypingRef.current) return;
    emitTypingEvent(true);
    isTypingRef.current = false;
    lastTypingStartRef.current = 0;
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const existingBytes = attachments.reduce((total, file) => total + file.size, 0);
    const incomingBytes = files.reduce((total, file) => total + file.size, 0);
    const combinedCount = attachments.length + files.length;
    const combinedBytes = existingBytes + incomingBytes;

    if (combinedCount > MAX_ATTACHMENT_COUNT) {
      const errorMessage = `You can attach a maximum of ${MAX_ATTACHMENT_COUNT} files per message.`;
      toast.error(errorMessage, { id: "attachment-limit" });
    } else if (combinedBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      const errorMessage = `Selected files total ${formatMegabytes(combinedBytes)} MB. The maximum total size is ${formatMegabytes(MAX_TOTAL_ATTACHMENT_BYTES)} MB. Remove some files and try again.`;
      toast.error(errorMessage, { id: "attachment-limit" });
    } else {
      setAttachments((prev) => [...prev, ...files]);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (indexToRemove: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const clearAttachments = () => {
    setAttachments([]);
    setUploadProgress({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const sendMessage = async () => {
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

    setMessage("");

    try {
      type UploadedAttachment = Awaited<ReturnType<typeof uploadFile>>;
      let uploadedAttachments: UploadedAttachment[] = [];

      if (currentAttachments.length > 0) {
        const progressMap: Record<number, number> = {};
        currentAttachments.forEach((_, i) => (progressMap[i] = 0));
        setUploadProgress(progressMap);

        uploadedAttachments = await Promise.all(
          currentAttachments.map((file, i) =>
            uploadFile(file, "attachment", (pct) =>
              setUploadProgress((prev) => ({ ...prev, [i]: pct })),
            ),
          ),
        );
        setUploadProgress({});
        toast.success(
          `${currentAttachments.length} ${currentAttachments.length === 1 ? "file" : "files"} uploaded successfully.`,
          { id: "attachment-upload-success" },
        );
      }

      const tempId = uuidv4();

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
          avatarUrl: (user as AuthenticatedChatUser).avatarUrl ?? null,
        },
      };

      const localPayload = { ...basePayload, attachments: localAttachments };
      const wirePayload = { ...basePayload, attachments: uploadedAttachments };

      if (isChannelView && activeChannelId) {
        const payload = channelMessagePayloadSchema.parse({
          channelId: activeChannelId,
          ...wirePayload,
        });
        addPendingMessage(activeChannelId, "channel", localPayload);
        socket.emit("send_channel_message", payload);
      } else if (isDMView && activeRoomId && selectedUser) {
        const payload = directMessagePayloadSchema.parse({
          roomId: activeRoomId,
          targetUserId: selectedUser.id,
          workspaceId: activeWorkspaceId || undefined,
          ...wirePayload,
        });
        addPendingMessage(activeRoomId, selectedUser.id, localPayload);
        socket.emit("sendPrivateMessage", payload);
      }

      setAttachments([]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Files could not be uploaded. Please retry.";
      toast.error(errorMessage, { id: "attachment-upload-error" });
      setMessage(currentText);
    } finally {
      setIsBatchSending(false);
      handleStopTypingExplicit();
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage();
  };

  if (!isChannelView && !isDMView) return null;
  const isSystemBusy = isBatchSending;

  return (
    <div className="p-4 bg-background">
      <div className="relative flex flex-col bg-muted/30 border border-border rounded-xl focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all shadow-sm">
        {attachments.length > 0 && (
          <div className="rounded-t-xl border-b border-border/50 bg-background/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-muted-foreground">
                {attachments.length} {attachments.length === 1 ? "file attached" : "files attached"}
              </span>
              {!isSystemBusy && (
                <button
                  type="button"
                  onClick={clearAttachments}
                  className="text-xs font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Clear all
                </button>
              )}
            </div>
            <div className="flex max-h-[184px] flex-wrap gap-2 overflow-y-auto pr-1 custom-scrollbar">
              {attachments.map((file, idx) => (
                <div key={`${file.name}-${file.size}-${file.lastModified}-${idx}`} className={isSystemBusy ? "pointer-events-none opacity-60" : ""}>
                  <AttachmentPreview
                    attachment={file}
                    isUploading={isSystemBusy}
                    progress={uploadProgress[idx] ?? 0}
                    onRemove={() => removeAttachment(idx)}
                  />
                </div>
              ))}
            </div>
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

