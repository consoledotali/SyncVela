"use client";

import React, { useEffect, useRef } from "react";
import { useChatStore } from "@/src/store/chat";
import { useAuthStore } from "@/src/store/authStore";
import { useSocket } from "@/src/providers/SocketProvider";
import { X, Loader2, Send } from "lucide-react";
import MessageBubble from "../MessageBubble";
import { v4 as uuidv4 } from "uuid";

export default function ThreadDrawer() {
  const { token, user } = useAuthStore();
  const { socket } = useSocket();
  const [replyInput, setReplyInput] = React.useState("");

  const {
    activeThreadParent,
    threadMessages,
    isFetchingThread,
    closeThread,
    setThreadMessages,
    setIsFetchingThread,
    addThreadReply,
    activeChannelId,
  } = useChatStore();

  const repliesContainerRef = useRef<HTMLDivElement>(null);

  // 🚀 Fetch Thread Database Records
  useEffect(() => {
    if (!activeThreadParent || !token) return;

    const fetchReplies = async () => {
      setIsFetchingThread(true);
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/messages/thread/${activeThreadParent.id}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (response.ok) {
          const data = await response.json();
          const normalizedReplies = (data.replies || []).map((msg: any) => ({
            id: msg.id,
            text: msg.content || "",
            senderId: msg.senderId,
            createdAt: msg.createdAt,
            attachments: msg.attachments || [],
            sender: msg.sender,
            status: msg.status || "delivered",
            parentMessageId: msg.parentMessageId || activeThreadParent.id,
          }));
          setThreadMessages(normalizedReplies);
        }
      } catch (error) {
        console.error("❌ Thread payload expansion critical failure:", error);
      } finally {
        setIsFetchingThread(false);
      }
    };

    fetchReplies();
  }, [activeThreadParent, token]);

  // Auto scroll logic for active reply ingestion
  useEffect(() => {
    if (repliesContainerRef.current) {
      repliesContainerRef.current.scrollTop =
        repliesContainerRef.current.scrollHeight;
    }
  }, [threadMessages]);

  if (!activeThreadParent) return null;

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInput.trim() || !socket || !user) return;

    const currentText = replyInput.trim();
    setReplyInput(""); // Instant UI Flush

    const tempId = uuidv4();

    const state = useChatStore.getState();
    const isDM = !!state.activeRoomId;
    const currentRoomId = state.activeRoomId;
    const targetUser = state.selectedUser;

    const payload = {
      id: tempId,
      tempId,
      text: currentText,
      senderId: user.id,
      attachments: [],
      createdAt: new Date().toISOString(),
      parentMessageId: activeThreadParent.id,
      channelId: isDM ? null : activeChannelId,
      conversationId: isDM ? currentRoomId : null,
      roomId: isDM ? currentRoomId : activeChannelId, // 🚀 BACKWARD COMPATIBILITY FIX: Backend won't miss it now
      status: "sent",
      sender: {
        id: user.id,
        name: user.name,
        avatarUrl: (user as any).avatarUrl || null,
      },
    };

    // Optimistic Update
    addThreadReply(payload as any);

    useChatStore.setState((prev) => {
      if (!prev.activeThreadParent) return prev;
      return {
        messages: prev.messages.map((m) =>
          m.id === prev.activeThreadParent!.id
            ? {
                ...m,
                _count: { replies: (m._count?.replies || 0) + 1 },
              }
            : m,
        ),
        activeThreadParent: {
          ...prev.activeThreadParent,
          _count: {
            replies: (prev.activeThreadParent._count?.replies || 0) + 1,
          },
        },
      };
    });

    // Smart Socket Emission
    if (!isDM && activeChannelId) {
      socket.emit("send_channel_message", payload);
    } else if (isDM && currentRoomId && targetUser) {
      socket.emit("sendPrivateMessage", {
        ...payload,
        roomId: currentRoomId,
        targetUserId: targetUser.id,
      });
    }
  };

  return (
    <div className="w-full md:w-[400px] border-l border-border h-[100dvh] bg-background flex flex-col relative z-30 shrink-0 shadow-xl md:shadow-none">
      <div className="p-4 border-b border-border h-[60px] flex items-center justify-between select-none bg-background">
        <div className="flex flex-col">
          <h3 className="font-bold text-[16px] text-foreground leading-tight">
            Thread
          </h3>
          <span className="text-[11px] text-muted-foreground font-medium">
            {activeChannelId ? "Inside channel view" : "Direct message"}
          </span>
        </div>
        <button
          onClick={closeThread}
          className="p-1.5 hover:bg-muted rounded-md transition-colors"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      <div
        ref={repliesContainerRef}
        className="flex-1 overflow-y-auto py-4 custom-scrollbar bg-background"
      >
        <div className="bg-muted/10 pb-4 border-b border-border/40">
          <MessageBubble
            msg={activeThreadParent}
            isMe={activeThreadParent.senderId === user?.id}
            hideHeader={false}
            isInsideThreadPanel={true}
          />
        </div>

        <div className="px-4 py-3 flex items-center gap-4 select-none">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
            {threadMessages.length}{" "}
            {threadMessages.length === 1 ? "Reply" : "Replies"}
          </span>
          <div className="h-px bg-border flex-1"></div>
        </div>

        {isFetchingThread ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground gap-2 text-sm font-medium">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading
            thread...
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {threadMessages.map((reply) => (
              <MessageBubble
                key={reply.id}
                msg={reply}
                isMe={reply.senderId === user?.id}
                hideHeader={false}
                isInsideThreadPanel={true}
              />
            ))}
          </div>
        )}
      </div>

      <div className="p-4 bg-background border-t border-border">
        <form
          onSubmit={handleSendReply}
          className="flex items-center bg-muted/30 border border-border rounded-xl p-1.5 focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all"
        >
          <input
            type="text"
            value={replyInput}
            onChange={(e) => setReplyInput(e.target.value)}
            placeholder="Reply to thread..."
            className="flex-1 bg-transparent border-none focus:outline-none px-3 py-1.5 text-sm placeholder:text-muted-foreground"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!replyInput.trim()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground p-2 rounded-lg transition-all disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

