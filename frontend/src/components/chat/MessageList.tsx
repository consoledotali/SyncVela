import React, { ForwardedRef } from "react";
import type { Message } from "@/src/types/messageTypes";
import MessageBubble from "./MessageBubble";
import { Badge } from "@/src/components/ui/badge";
import { Loader2 } from "lucide-react";

const getLocalDayKey = (timestamp: string) => {
  const date = new Date(timestamp);
  return [date.getFullYear(), date.getMonth(), date.getDate()].join("-");
};

const formatDayDivider = (timestamp: string) => {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (getLocalDayKey(timestamp) === getLocalDayKey(today.toISOString())) {
    return "Today";
  }
  if (getLocalDayKey(timestamp) === getLocalDayKey(yesterday.toISOString())) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  }).format(date);
};

interface MessageListProps {
  messages: Message[];
  userId: string | undefined;
  isLoadingHistory: boolean;
  searchTerm: string;
  isDMView: boolean;
  targetLastReadAt: string | null;
  isLoadingMore: boolean;
  isSearching: boolean;
  searchHasMore: boolean;
  searchError: string | null;
  onLoadMoreSearchResults: () => void;
  typingParticipantNames: string[];
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  innerRef: React.RefObject<HTMLDivElement | null>;
}

export const MessageList = React.forwardRef(
  (
    {
      messages,
      userId,
      isLoadingHistory,
      searchTerm,
      isDMView,
      targetLastReadAt,
      isLoadingMore,
      isSearching,
      searchHasMore,
      searchError,
      onLoadMoreSearchResults,
      typingParticipantNames,
      onScroll,
      innerRef,
    }: MessageListProps,
    ref: ForwardedRef<HTMLDivElement>,
  ) => {
    return (
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex-1 px-4 py-6 overflow-y-auto bg-background custom-scrollbar relative"
      >
        <div ref={innerRef} className="flex flex-col gap-1 relative min-h-full">
          {isLoadingHistory && messages.length === 0 ? (
            <div className="space-y-4" aria-label="Loading message history" aria-busy="true">
              {[0, 1, 2, 3, 4].map((item) => (
                <div key={item} className={`flex items-start gap-3 ${item % 2 ? "pl-10" : ""}`}>
                  <div className="h-9 w-9 shrink-0 animate-pulse rounded-md bg-muted" />
                  <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                    <div className="h-3 w-28 animate-pulse rounded bg-muted" />
                    <div className={`h-4 animate-pulse rounded bg-muted ${item % 2 ? "w-2/3" : "w-5/6"}`} />
                    {item === 2 && <div className="h-16 w-56 animate-pulse rounded-lg bg-muted" />}
                  </div>
                </div>
              ))}
            </div>
          ) : isLoadingMore && (
            <div className="flex justify-center p-2">
              <Badge
                variant="outline"
                className="text-xs text-muted-foreground gap-2"
              >
                <Loader2 className="h-3 w-3 animate-spin" /> Loading history...
              </Badge>
            </div>
          )}

          {isSearching && searchTerm.trim().length >= 2 && messages.length === 0 && (
            <div className="flex min-h-40 items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground" role="status" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Searching messages…
            </div>
          )}
          {!isSearching && searchError && searchTerm.trim().length >= 2 && (
            <div className="flex min-h-40 items-center justify-center px-6 text-center text-sm text-destructive" role="alert">
              {searchError}
            </div>
          )}
          {!isSearching && !searchError && searchTerm.trim().length >= 2 && messages.length === 0 && (
            <div className="flex min-h-40 items-center justify-center px-6 text-center text-sm text-muted-foreground" role="status">
              No messages found for “{searchTerm.trim()}”.
            </div>
          )}

          {messages.map((msg, index) => {
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const isConsecutive = prevMsg
              ? prevMsg.senderId === msg.senderId &&
                new Date(msg.createdAt).getTime() -
                  new Date(prevMsg.createdAt).getTime() <
                  5 * 60 * 1000
              : false;
            const startsNewDay =
              !prevMsg ||
              getLocalDayKey(msg.createdAt) !== getLocalDayKey(prevMsg.createdAt);

            return (
              <div key={msg.id} data-message-id={msg.id} className="w-full">
                {startsNewDay && (
                  <div
                    className="relative my-6 flex items-center justify-center"
                    role="separator"
                    aria-label={`Messages from ${formatDayDivider(msg.createdAt)}`}
                  >
                    <div className="absolute inset-x-0 top-1/2 border-t border-border/80" />
                    <span className="relative rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm">
                      {formatDayDivider(msg.createdAt)}
                    </span>
                  </div>
                )}
                <MessageBubble
                  msg={msg}
                  isMe={userId === msg.senderId}
                  isReadRealtime={
                    !!(
                      isDMView &&
                      userId === msg.senderId &&
                      targetLastReadAt &&
                      new Date(msg.createdAt) <= new Date(targetLastReadAt)
                    )
                  }
                  hideHeader={isConsecutive}
                />
              </div>
            );
          })}

          {searchTerm.trim().length >= 2 && searchHasMore && (
            <div className="flex justify-center py-4">
              <button
                type="button"
                onClick={onLoadMoreSearchResults}
                disabled={isSearching}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSearching ? "Loading results…" : "Load more results"}
              </button>
            </div>
          )}

          {typingParticipantNames.length > 0 && (
            <div className="flex items-center gap-2 pl-14 pt-2 text-[13px] font-medium text-muted-foreground" aria-live="polite">
              <span className="flex gap-0.5" aria-hidden="true">
                <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:-0.2s]" />
                <span className="h-1 w-1 rounded-full bg-current animate-bounce [animation-delay:-0.1s]" />
                <span className="h-1 w-1 rounded-full bg-current animate-bounce" />
              </span>
              {typingParticipantNames.length === 1
                ? `${typingParticipantNames[0].split(" ")[0]} is typing...`
                : `${typingParticipantNames.slice(0, 2).map((name) => name.split(" ")[0]).join(", ")} are typing...`}
            </div>
          )}

          <div id="chat-bottom-anchor" className="h-px w-full shrink-0 mt-2" />
        </div>
      </div>
    );
  },
);

MessageList.displayName = "MessageList";

