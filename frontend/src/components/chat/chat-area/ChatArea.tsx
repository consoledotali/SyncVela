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
  // 🚀 1. SYNCHRONOUS DOM ANCHOR (Pagination)
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
          container.scrollTop = container.scrollHeight - prevScrollHeightRef.current;
        }
      } else {
        container.scrollTop = container.scrollHeight - prevScrollHeightRef.current;
      }

      isPrependingRef.current = false;
      topMessageIdRef.current = null;
    }
  }, [messages]);

  const handleScroll = async () => {
    if (!scrollContainerRef.current || !token) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;

    isUserScrolledUpRef.current = scrollHeight - scrollTop - clientHeight > 10;

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
            sender: msg.sender,
          }));

          const remoteHasMore = data.hasMore !== undefined ? data.hasMore : false;
          const remoteCursor = data.nextCursor !== undefined ? data.nextCursor : null;

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
  // 🚀 2. CHANNEL SWITCH RESET (THE AMNESIA FIX)
  // ==========================================
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      isUserScrolledUpRef.current = false;
      // 🔴 THE FATAL FLAW FIXED: Resetting to null so Block 3 knows it's a First Load.
      lastMessageIdRef.current = null;
    }
  }, [activeChannelId, activeRoomId]);

  // ==========================================
  // 🚀 3. SMART AUTO-SCROLL (The Bulletproof Engine)
  // ==========================================
  useEffect(() => {
    let t1: NodeJS.Timeout, t2: NodeJS.Timeout;
    const container = scrollContainerRef.current;

    if (container && messages.length > 0) {
      const currentLastMessageId = messages[messages.length - 1].id;

      if (
        lastMessageIdRef.current !== currentLastMessageId &&
        !isPrependingRef.current
      ) {
        const isFirstLoad = lastMessageIdRef.current === null;

        if (
          !isUserScrolledUpRef.current ||
          messages[messages.length - 1].senderId === user?.id
        ) {
          // 🟢 THE FIX: DOM Node targeting instead of raw scrollHeight math
          const forceScroll = () => {
            const anchor = container.querySelector("#chat-bottom-anchor");
            if (anchor) {
              anchor.scrollIntoView({
                behavior: isFirstLoad ? "auto" : "smooth",
                block: "end",
              });
            } else {
              container.scrollTop = container.scrollHeight;
            }
          };

          // Attempt 1: Instant try
          forceScroll();
          
          // Attempt 2: 100ms delay (Standard React render time)
          t1 = setTimeout(forceScroll, 100);
          
          // Attempt 3: 400ms delay (Safety net for heavy DOM paints)
          t2 = setTimeout(forceScroll, 400);
        }
        lastMessageIdRef.current = currentLastMessageId;
      }
    } else if (container && messages.length === 0) {
      lastMessageIdRef.current = null;
    }

    return () => {
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [messages, user?.id]);

  // ==========================================
  // 🚀 4. THE LAYOUT SHIFT ENGINE (Images Fix)
  // ==========================================
  useEffect(() => {
    const container = scrollContainerRef.current;
    const inner = innerContentRef.current;
    if (!container || !inner) return;

    const observer = new ResizeObserver(() => {
      if (!isPrependingRef.current) {
        if (!isUserScrolledUpRef.current) {
          container.scrollTop = container.scrollHeight;
        }
      }
    });

    observer.observe(inner);
    return () => observer.disconnect();
  }, [activeChannelId, activeRoomId]);

  // ==========================================
  // 🚀 5. TYPING INDICATOR SHIFT
  // ==========================================
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container && isCurrentlyTyping && !isUserScrolledUpRef.current) {
      setTimeout(() => {
        container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
      }, 50);
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
  );
}