import React, { useRef, useEffect } from "react";
import { useChatStore } from "@/src/store/chat";
import { useAuthStore } from "@/src/store/authStore";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Lock, Loader2, ArrowLeft, Hash } from "lucide-react";

export default function ChatArea() {
  const { user } = useAuthStore();
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isCurrentlyTyping = selectedUser
    ? typingUsers.includes(selectedUser.id)
    : false;

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const isChannelView = !!activeChannelId && !!activeChannel;
  const isDMView = !!selectedUser;

  const handleScroll = async () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight } = scrollContainerRef.current;

    // TODO: Add pagination API call logic for channels later
    if (
      scrollTop === 0 &&
      hasMore &&
      !isLoadingMore &&
      nextCursor &&
      activeRoomId
    ) {
      setIsLoadingMore(true);
      const previousScrollHeight = scrollHeight;
      try {
        const res = await fetch(
          `http://localhost:5000/api/chat/${activeRoomId}/messages?cursor=${nextCursor}`,
        );
        if (res.ok) {
          const data = await res.json();
          prependMessages(data.messages);
          setPagination(data.hasMore, data.nextCursor);
          setTimeout(() => {
            if (scrollContainerRef.current)
              scrollContainerRef.current.scrollTop =
                scrollContainerRef.current.scrollHeight - previousScrollHeight;
          }, 0);
        }
      } catch (err) {
        console.error("Failed to load older messages", err);
      } finally {
        setIsLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container)
      setTimeout(() => (container.scrollTop = container.scrollHeight), 100);
  }, [messages, isCurrentlyTyping]);

  // 🛡️ EMPTY STATE (When neither Channel nor DM is selected)
  if (!isChannelView && !isDMView) {
    return (
      <div className="hidden md:flex flex-1 items-center justify-center bg-background h-[100dvh]">
        <div className="text-center space-y-3 px-4">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Hash className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome to {activeWorkspace ? activeWorkspace.name : "SyncVela"}
          </h2>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Select a channel or direct message from the sidebar to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col h-[100dvh] bg-background relative">
      {/* 🔴 SLACK STYLE DYNAMIC HEADER */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-background">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0 -ml-2 text-muted-foreground"
            onClick={() => {
              setSelectedUser(null);
              setActiveChannelId(null);
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {isChannelView ? (
            <div className="flex flex-col">
              <h2 className="text-[17px] font-bold text-foreground flex items-center gap-1.5 leading-tight">
                {activeChannel.type === "PRIVATE" ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Hash className="h-5 w-5 text-muted-foreground" />
                )}
                {activeChannel.name}
              </h2>
            </div>
          ) : (
            <>
              <Avatar className="h-8 w-8 rounded-md border border-border">
                <AvatarImage
                  src={`https://api.dicebear.com/7.x/initials/svg?seed=${selectedUser?.name}`}
                />
                <AvatarFallback className="rounded-md bg-primary/10 text-primary">
                  {selectedUser?.name?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <h2 className="text-[17px] font-bold text-foreground leading-tight">
                  {selectedUser?.name}
                </h2>
              </div>
            </>
          )}
        </div>
      </header>

      {/* 💬 MESSAGES LIST */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 px-4 py-6 overflow-y-auto flex flex-col gap-1 bg-background scroll-smooth"
      >
        {isLoadingMore && (
          <div className="flex justify-center p-2">
            <Badge
              variant="outline"
              className="text-xs text-muted-foreground gap-2"
            >
              <Loader2 className="h-3 w-3 animate-spin" /> Loading history...
            </Badge>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="mt-auto mb-4 px-2">
            <h1 className="text-3xl font-bold mb-2">
              {isChannelView
                ? `Welcome to #${activeChannel.name}!`
                : `${selectedUser?.name}`}
            </h1>
            <p className="text-muted-foreground text-[15px]">
              {isChannelView
                ? `This is the start of the #${activeChannel.name} channel.`
                : `This is the beginning of your direct message history with ${selectedUser?.name}.`}
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            // 🛡️ THE GROUPING FIX: Check consecutive messages within 5 minutes
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const isConsecutive = prevMsg
              ? prevMsg.senderId === msg.senderId &&
                new Date(msg.createdAt).getTime() -
                  new Date(prevMsg.createdAt).getTime() <
                  5 * 60 * 1000
              : false;

            return (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isMe={user?.id === msg.senderId}
                isReadRealtime={
                  !!(
                    isDMView &&
                    user?.id === msg.senderId &&
                    targetLastReadAt &&
                    new Date(msg.createdAt) <= new Date(targetLastReadAt)
                  )
                }
                hideHeader={isConsecutive} // 🟢 Pass the grouping flag to hide duplicate avatars
              />
            );
          })
        )}

        {isCurrentlyTyping && (
          <div className="text-[13px] font-medium text-muted-foreground pl-14 pt-2">
            {selectedUser?.name.split(" ")[0]} is typing...
          </div>
        )}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* 📥 CHAT INPUT AREA */}
      <ChatInput />
    </div>
  );
}
