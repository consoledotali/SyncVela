"use client";

import React, { useRef, useEffect, useLayoutEffect } from "react";
import { useChatStore } from "@/src/store/chat";
import { useAuthStore } from "@/src/store/authStore";
import ChatInput from "@/src/components/chat/chat-input/ChatInput";

import EmptyState from "./EmptyState";
import ChatHeader from "./ChatHeader";
import { MessageList } from "./MessageList";

export default function ChatArea() {
  const { user, token } = useAuthStore();
  const {
    messages,
    selectedUser,
    setSelectedUser,
    activeRoomId,
    activeChannelId,
    setActiveChannelId,
    channels,
    workspaces,
    activeWorkspaceId,
    targetLastReadAt,
    hasMore,
    nextCursor,
    isLoadingMore,
    setPagination,
    prependMessages,
    setIsLoadingMore,
    typingUsers,
  } = useChatStore();

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 🛡️ THE FIX: Refs to block layout flash synchronously
  const isPrependingRef = useRef(false);
  const prevScrollHeightRef = useRef(0);
  const lastMessageIdRef = useRef<string | null>(null);

  const isCurrentlyTyping = selectedUser
    ? typingUsers.includes(selectedUser.id)
    : false;
  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const isChannelView = !!activeChannelId && !!activeChannel;
  const isDMView = !!selectedUser;

  // ==========================================
  // 🚀 THE SYNCHRONOUS LAYOUT ANCHOR ENGINE
  // ==========================================
  useLayoutEffect(() => {
    // Yeh block tab chalega jab naye messages DOM mein aachuke honge par browser ne abhi tak paint na kiya ho
    if (isPrependingRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;

      // Calculate exact delta and snap the scroll position instantly
      container.scrollTop =
        container.scrollHeight - prevScrollHeightRef.current;

      // Lock kholo taake normal messages scroll kharab na ho
      isPrependingRef.current = false;
    }
  }, [messages]);

  const handleScroll = async () => {
    if (!scrollContainerRef.current || !token) return;
    const { scrollTop, scrollHeight } = scrollContainerRef.current;

    // Trigger explicit loader only when pinpointing absolute top
    if (scrollTop === 0 && hasMore && !isLoadingMore && nextCursor) {
      let endpoint = "";
      if (isChannelView && activeChannelId) {
        endpoint = `http://localhost:5000/api/messages/channel/${activeChannelId}?cursor=${nextCursor}`;
      } else if (isDMView && activeRoomId) {
        endpoint = `http://localhost:5000/api/messages/dm/${activeRoomId}?cursor=${nextCursor}`;
      } else {
        return;
      }

      setIsLoadingMore(true);

      // Snapshot the exact scroll height BEFORE mutating state
      prevScrollHeightRef.current = scrollHeight;
      isPrependingRef.current = true; // Activate the synchronous layout lock

      try {
        const res = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          const rawMessages = data.messages ? data.messages : data;

          const formattedHistoricalMessages = rawMessages.map((msg: any) => ({
            id: msg.id,
            text: msg.content,
            senderId: msg.senderId,
            createdAt: msg.createdAt,
            attachmentUrl: msg.attachmentUrl,
            sender: msg.sender,
          }));

          const remoteHasMore =
            data.hasMore !== undefined ? data.hasMore : false;
          const remoteCursor =
            data.nextCursor !== undefined ? data.nextCursor : null;

          // State updates will batch and trigger the useLayoutEffect above
          prependMessages(formattedHistoricalMessages);
          setPagination(remoteHasMore, remoteCursor);
        } else {
          isPrependingRef.current = false; // Reset lock if API fails
        }
      } catch (err) {
        console.error("❌ Failed to load historical messages:", err);
        isPrependingRef.current = false;
      }
      {
        setIsLoadingMore(false);
      }
    }
  };

  // Smart Auto-Scroll for New Messages (Bottom Anchoring)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container && messages.length > 0) {
      const currentLastMessageId = messages[messages.length - 1].id;

      // Scroll to bottom ONLY if a real new message arrives, not when prepending history
      if (
        lastMessageIdRef.current !== currentLastMessageId &&
        !isPrependingRef.current
      ) {
        setTimeout(() => (container.scrollTop = container.scrollHeight), 50);
        lastMessageIdRef.current = currentLastMessageId;
      }
    } else if (container && messages.length === 0) {
      lastMessageIdRef.current = null;
    }
  }, [messages]);

  // Handle typing indicator shift
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container && isCurrentlyTyping) {
      setTimeout(() => (container.scrollTop = container.scrollHeight), 50);
    }
  }, [isCurrentlyTyping]);

  if (!isChannelView && !isDMView) {
    return <EmptyState activeWorkspace={activeWorkspace} />;
  }

  return (
    <div className="flex flex-1 flex-col h-[100dvh] bg-background relative">
      <ChatHeader
        isChannelView={isChannelView}
        activeChannel={activeChannel}
        selectedUser={selectedUser}
        onBack={() => {
          setSelectedUser(null);
          setActiveChannelId(null);
        }}
      />

      <MessageList
        ref={scrollContainerRef}
        messages={messages}
        userId={user?.id}
        isDMView={isDMView}
        targetLastReadAt={targetLastReadAt}
        isLoadingMore={isLoadingMore}
        isCurrentlyTyping={isCurrentlyTyping}
        selectedUser={selectedUser}
        onScroll={handleScroll}
      />

      <ChatInput />
    </div>
  );
}
