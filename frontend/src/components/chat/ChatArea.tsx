import React, { useRef, useEffect } from "react";
import { useChatStore } from "@/src/store/chatStore";
import { useAuthStore } from "@/src/store/authStore";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";

// Shadcn Components & Icons
import { Badge } from "@/src/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import { Button } from "@/src/components/ui/button"; // NAYA: Back button ke liye
import { Lock, Loader2, ArrowLeft } from "lucide-react"; // NAYA: ArrowLeft icon

export default function ChatArea() {
  const { user } = useAuthStore();
  const {
    messages,
    selectedUser,
    setSelectedUser, // NAYA: Mobile par back aane ke liye
    activeRoomId,
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

  const handleScroll = async () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight } = scrollContainerRef.current;

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
          const formattedOlder = data.messages.map((msg: any) => ({
            id: msg.id,
            text: msg.content,
            senderId: msg.senderId,
            createdAt: msg.createdAt,
            attachmentUrl: msg.attachmentUrl,
          }));
          prependMessages(formattedOlder);
          setPagination(data.hasMore, data.nextCursor);
          setTimeout(() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop =
                scrollContainerRef.current.scrollHeight - previousScrollHeight;
            }
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

  // 🛡️ MOBILE STATE 1: Agar user select nahi hua, toh Chat Area mobile par "hidden" hoga aur sirf desktop ("md:flex") par dikhega.
  if (!selectedUser) {
    return (
      <div className="hidden md:flex flex-1 items-center justify-center bg-muted/20 h-[100dvh]">
        <div className="text-center space-y-3 px-4">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            SyncVela Workspace
          </h2>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Select a contact from the sidebar to start a secure, end-to-end
            encrypted conversation.
          </p>
        </div>
      </div>
    );
  }

  const initials = selectedUser.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

  // 🛡️ MOBILE STATE 2: Jab user select ho jaye, toh Chat Area mobile par full screen ("flex") ho jayega.
  return (
    <div className="flex flex-1 flex-col h-[100dvh] bg-background relative">
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* 🛡️ THE FIX: Mobile Back Button. Ye sirf mobile ("md:hidden") par dikhega. */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden shrink-0 -ml-2 text-muted-foreground hover:text-foreground"
            onClick={() => setSelectedUser(null)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <Avatar className="h-10 w-10 border border-border">
            <AvatarImage
              src={`https://api.dicebear.com/7.x/initials/svg?seed=${selectedUser.name}`}
              alt={selectedUser.name}
            />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex flex-col">
            <h2 className="text-md font-semibold text-foreground leading-tight">
              {selectedUser.name}
            </h2>
            <span className="text-xs text-muted-foreground truncate max-w-[120px] sm:max-w-[200px]">
              {selectedUser.email}
            </span>
          </div>
        </div>

        <Badge
          variant={activeRoomId ? "default" : "secondary"}
          className="gap-1.5 shadow-none hidden sm:inline-flex"
        >
          {activeRoomId ? (
            <>
              <Lock className="h-3 w-3" /> Secured
            </>
          ) : (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Securing...
            </>
          )}
        </Badge>
      </header>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 bg-muted/10 scroll-smooth"
      >
        {isLoadingMore && (
          <div className="flex justify-center p-2">
            <Badge
              variant="outline"
              className="text-xs text-muted-foreground bg-background shadow-sm gap-2"
            >
              <Loader2 className="h-3 w-3 animate-spin" /> Loading history...
            </Badge>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center opacity-50 my-10">
            <p className="text-sm font-medium text-foreground">
              This is the beginning of your chat
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Messages are secured with enterprise-grade encryption.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isMe={user?.id === msg.senderId}
              isReadRealtime={
                !!(
                  user?.id === msg.senderId &&
                  targetLastReadAt &&
                  new Date(msg.createdAt) <= new Date(targetLastReadAt)
                )
              }
            />
          ))
        )}

        {isCurrentlyTyping && (
          <div className="self-start px-4 py-2 bg-muted text-muted-foreground rounded-2xl rounded-bl-sm text-xs font-medium flex items-center gap-2">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 bg-muted-foreground/50 rounded-full animate-bounce" />
              <span className="h-1.5 w-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
            </span>
            {selectedUser.name.split(" ")[0]} is typing
          </div>
        )}
        <div ref={messagesEndRef} className="h-1" />
      </div>

      <div className="mt-auto border-t border-border bg-background">
        <ChatInput />
      </div>
    </div>
  );
}
