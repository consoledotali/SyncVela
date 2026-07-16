"use client";

import React, { useRef, useEffect, useLayoutEffect } from "react";
import { useChatStore } from "@/src/store/chat";
import { useAuthStore } from "@/src/store/authStore";
import ChatInput from "@/src/components/chat/chat-input/ChatInput";

import EmptyState from "./EmptyState";
import ChatHeader from "./ChatHeader";
import { MessageList } from "./MessageList";
import ThreadDrawer from "../sidebar/ThreadDrawer";

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
  const innerContentRef = useRef<HTMLDivElement>(null);

  // 🛡️ SCROLL STATE & LOCKS
  const isPrependingRef = useRef(false);
  const topMessageIdRef = useRef<string | null>(null);
  const prevScrollHeightRef = useRef(0);
  const lastMessageIdRef = useRef<string | null>(null);
  const isUserScrolledUpRef = useRef(false);

  const isCurrentlyTyping = selectedUser
    ? typingUsers.includes(selectedUser.id)
    : false;
  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const isChannelView = !!activeChannelId && !!activeChannel;
  const isDMView = !!selectedUser;

  // ==========================================
  // 🚀 1. SYNCHRONOUS DOM ANCHOR
  // ==========================================
  useLayoutEffect(() => {
    if (isPrependingRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;

      if (topMessageIdRef.current) {
        const anchorElement = container.querySelector(
          `[data-message-id="${topMessageIdRef.current}"]`,
        ) as HTMLElement;
        if (anchorElement) {
          container.scrollTop = anchorElement.offsetTop - 10;
        } else {
          container.scrollTop =
            container.scrollHeight - prevScrollHeightRef.current;
        }
      } else {
        container.scrollTop =
          container.scrollHeight - prevScrollHeightRef.current;
      }

      isPrependingRef.current = false;
      topMessageIdRef.current = null;
    }
  }, [messages]);

  // ==========================================
  // 🚀 2. SCROLL LISTENER
  // ==========================================
  const handleScroll = async () => {
    if (!scrollContainerRef.current || !token) return;
    const { scrollTop, scrollHeight, clientHeight } =
      scrollContainerRef.current;

    isUserScrolledUpRef.current = scrollHeight - scrollTop - clientHeight > 100;

    if (scrollTop === 0 && hasMore && !isLoadingMore && nextCursor) {
      if (messages.length > 0) {
        topMessageIdRef.current = messages[0].id;
      }

      let endpoint = "";
      if (isChannelView && activeChannelId) {
        endpoint = `http://localhost:5000/api/messages/channel/${activeChannelId}?cursor=${nextCursor}`;
      } else if (isDMView && activeRoomId) {
        endpoint = `http://localhost:5000/api/messages/dm/${activeRoomId}?cursor=${nextCursor}`;
      } else {
        return;
      }

      setIsLoadingMore(true);
      prevScrollHeightRef.current = scrollHeight;
      isPrependingRef.current = true;

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
            attachments: msg.attachments || [],
            sender: msg.sender,
            _count: msg._count, // 🚀 Retain count for historical threads
          }));

          const remoteHasMore =
            data.hasMore !== undefined ? data.hasMore : false;
          const remoteCursor =
            data.nextCursor !== undefined ? data.nextCursor : null;

          prependMessages(formattedHistoricalMessages);
          setPagination(remoteHasMore, remoteCursor);
        } else {
          isPrependingRef.current = false;
        }
      } catch (err) {
        console.error("❌ Failed to load historical messages:", err);
        isPrependingRef.current = false;
      }
      setIsLoadingMore(false);
    }
  };

  // ==========================================
  // 🚀 3. CHANNEL SWITCH RESET
  // ==========================================
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      isUserScrolledUpRef.current = false;
      lastMessageIdRef.current = null;
    }
  }, [activeChannelId, activeRoomId]);

  // ==========================================
  // 🚀 4. THE BULLETPROOF AUTO-SCROLL ENGINE
  // ==========================================
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || messages.length === 0 || isPrependingRef.current) return;

    const currentLastMessage = messages[messages.length - 1];

    if (lastMessageIdRef.current !== currentLastMessage.id) {
      const isFirstLoad = lastMessageIdRef.current === null;
      const isMyMessage = currentLastMessage.senderId === user?.id;

      if (isFirstLoad || isMyMessage || !isUserScrolledUpRef.current) {
        const forceScrollBottom = () => {
          container.scrollTop = container.scrollHeight;
        };

        forceScrollBottom();

        requestAnimationFrame(() => {
          forceScrollBottom();
          setTimeout(forceScrollBottom, 150);
        });
      }
      lastMessageIdRef.current = currentLastMessage.id;
    }
  }, [messages, user?.id]);

  // ==========================================
  // 🚀 5. RESIZE OBSERVER
  // ==========================================
  useEffect(() => {
    const container = scrollContainerRef.current;
    const inner = innerContentRef.current;
    if (!container || !inner) return;

    const observer = new ResizeObserver(() => {
      if (!isPrependingRef.current && !isUserScrolledUpRef.current) {
        container.scrollTop = container.scrollHeight;
      }
    });

    observer.observe(inner);
    return () => observer.disconnect();
  }, [activeChannelId, activeRoomId]);

  // ==========================================
  // 🚀 6. TYPING INDICATOR SHIFT
  // ==========================================
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container && isCurrentlyTyping && !isUserScrolledUpRef.current) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, [isCurrentlyTyping]);

  if (!isChannelView && !isDMView) {
    return <EmptyState activeWorkspace={activeWorkspace} />;
  }

  // 🚀 7. THE MASTER LAYOUT ENGINE (ThreadDrawer Injected here)
  return (
    <div className="flex flex-1 h-[100dvh] bg-background relative overflow-hidden">
      <div className="flex flex-1 flex-col h-full bg-background relative min-w-0">
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
          innerRef={innerContentRef}
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

      {/* 🚀 THE ENTERPRISE COLLABORATION THREAD LAYOUT DRAWER */}
      <ThreadDrawer />
    </div>
  );
}
