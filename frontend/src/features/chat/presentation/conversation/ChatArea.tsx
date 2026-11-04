"use client";

import React, { useRef, useEffect, useLayoutEffect, useState } from "react";
import { useChatStore, type Message } from "@/src/features/chat/state";
import { useAuthStore } from "@/src/store/authStore";
import ChatInput from "@/src/features/chat/presentation/composer/ChatInput";

import EmptyState from "./EmptyState";
import ChatHeader from "./ChatHeader";
import { MessageList } from "../messages/MessageList";
import ThreadDrawer from "../threads/ThreadDrawer";
import { authFetch } from "@/src/lib/authFetch";

interface HistoricalMessagePayload {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  attachmentUrl?: string | null;
  attachments?: Message["attachments"];
  sender?: Message["sender"];
  _count?: Message["_count"];
  reactions?: Message["reactions"];
}

interface HistoricalMessagePage {
  messages?: HistoricalMessagePayload[];
  hasMore?: boolean;
  nextCursor?: string | null;
}

type SearchMessagePage = HistoricalMessagePage;

export default function ChatArea() {
  const { user, token } = useAuthStore();
  const {
    messages,
    selectedUser,
    isLoading,
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
    typingParticipants,
    users,
  } = useChatStore();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const innerContentRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searchCursor, setSearchCursor] = useState<string | null>(null);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRequestIdRef = useRef(0);

  // 🛡️ SCROLL STATE & LOCKS
  const isPrependingRef = useRef(false);
  const topMessageIdRef = useRef<string | null>(null);
  const prevScrollHeightRef = useRef(0);
  const lastMessageIdRef = useRef<string | null>(null);
  const isUserScrolledUpRef = useRef(false);

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const isChannelView = !!activeChannelId && !!activeChannel;
  const isDMView = !!selectedUser;
  const typingConversationKey = isChannelView
    ? `channel:${activeChannelId}`
    : selectedUser
      ? `dm:${selectedUser.id}`
      : null;
  const typingParticipantNames = typingConversationKey
    ? Object.entries(typingParticipants[typingConversationKey] ?? {})
        .map(([userId]) => {
          if (selectedUser?.id === userId) return selectedUser.name;
          return users.find((member) => member.id === userId)?.name;
        })
        .filter((name): name is string => Boolean(name))
    : [];
  const isCurrentlyTyping = typingParticipantNames.length > 0;
  const normalizedSearchTerm = searchTerm.trim();
  const hasActiveSearch = normalizedSearchTerm.length >= 2;
  const visibleMessages = hasActiveSearch ? searchResults : messages;

  useEffect(() => {
    const query = searchTerm.trim();
    const requestId = ++searchRequestIdRef.current;
    if (query.length < 2 || (!activeChannelId && !activeRoomId)) {
      return;
    }

    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const params = new URLSearchParams({ q: query });
        if (isChannelView && activeChannelId) params.set("channelId", activeChannelId);
        if (isDMView && activeRoomId) params.set("conversationId", activeRoomId);
        const response = await authFetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/messages/search?${params.toString()}`,
        );
        if (!response.ok) throw new Error("Message search failed.");
        const data = (await response.json()) as SearchMessagePage;
        if (requestId !== searchRequestIdRef.current) return;
        setSearchResults(
          (data.messages ?? []).map((msg) => ({
            id: msg.id,
            text: msg.content,
            senderId: msg.senderId,
            createdAt: msg.createdAt,
            attachmentUrl: msg.attachmentUrl,
            attachments: msg.attachments || [],
            sender: msg.sender,
            _count: msg._count,
            reactions: msg.reactions || [],
          })),
        );
        setSearchCursor(data.nextCursor ?? null);
        setSearchHasMore(data.hasMore ?? false);
      } catch (error) {
        if (requestId === searchRequestIdRef.current) {
          setSearchResults([]);
          setSearchCursor(null);
          setSearchHasMore(false);
          setSearchError(error instanceof Error ? error.message : "Message search failed.");
        }
      } finally {
        if (requestId === searchRequestIdRef.current) setIsSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [activeChannelId, activeRoomId, isChannelView, isDMView, searchTerm]);

  const loadMoreSearchResults = async () => {
    if (!searchHasMore || !searchCursor || isSearching || !hasActiveSearch) return;
    setIsSearching(true);
    try {
      const params = new URLSearchParams({ q: normalizedSearchTerm, cursor: searchCursor });
      if (isChannelView && activeChannelId) params.set("channelId", activeChannelId);
      if (isDMView && activeRoomId) params.set("conversationId", activeRoomId);
      const response = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/messages/search?${params.toString()}`,
      );
      if (!response.ok) throw new Error("Could not load more search results.");
      const data = (await response.json()) as SearchMessagePage;
      const nextMessages = (data.messages ?? []).map((msg) => ({
        id: msg.id,
        text: msg.content,
        senderId: msg.senderId,
        createdAt: msg.createdAt,
        attachmentUrl: msg.attachmentUrl,
        attachments: msg.attachments || [],
        sender: msg.sender,
        _count: msg._count,
        reactions: msg.reactions || [],
      }));
      setSearchResults((current) => {
        const existing = new Set(current.map((message) => message.id));
        return [...current, ...nextMessages.filter((message) => !existing.has(message.id))];
      });
      setSearchCursor(data.nextCursor ?? null);
      setSearchHasMore(data.hasMore ?? false);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Could not load more search results.");
    } finally {
      setIsSearching(false);
    }
  };

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
        endpoint = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/messages/channel/${activeChannelId}?cursor=${nextCursor}`;
      } else if (isDMView && activeRoomId) {
        endpoint = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/messages/dm/${activeRoomId}?cursor=${nextCursor}`;
      } else {
        return;
      }

      setIsLoadingMore(true);
      prevScrollHeightRef.current = scrollHeight;
      isPrependingRef.current = true;

      try {
        const res = await authFetch(endpoint);

        if (res.ok) {
          const data: HistoricalMessagePage | HistoricalMessagePayload[] = await res.json();
          const rawMessages = Array.isArray(data) ? data : (data.messages ?? []);

          const formattedHistoricalMessages: Message[] = rawMessages.map((msg) => ({
            id: msg.id,
            text: msg.content,
            senderId: msg.senderId,
            createdAt: msg.createdAt,
            attachmentUrl: msg.attachmentUrl,
            attachments: msg.attachments || [],
            sender: msg.sender,
            _count: msg._count, // 🚀 Retain count for historical threads
            reactions: msg.reactions || [],
          }));

          const remoteHasMore = Array.isArray(data) ? false : (data.hasMore ?? false);
          const remoteCursor = Array.isArray(data) ? null : (data.nextCursor ?? null);

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
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          onBack={() => {
            setSelectedUser(null);
            setActiveChannelId(null);
          }}
        />

        <MessageList
          ref={scrollContainerRef}
          innerRef={innerContentRef}
          messages={visibleMessages}
          userId={user?.id}
          isLoadingHistory={isLoading}
          searchTerm={searchTerm}
          isDMView={isDMView}
          isSearching={hasActiveSearch && isSearching}
          searchHasMore={hasActiveSearch && searchHasMore}
          searchError={searchError}
          onLoadMoreSearchResults={loadMoreSearchResults}
          targetLastReadAt={targetLastReadAt}
          isLoadingMore={isLoadingMore}
          typingParticipantNames={typingParticipantNames}
          onScroll={handleScroll}
        />

        <ChatInput />
      </div>

      {/* 🚀 THE ENTERPRISE COLLABORATION THREAD LAYOUT DRAWER */}
      <ThreadDrawer />
    </div>
  );
}

