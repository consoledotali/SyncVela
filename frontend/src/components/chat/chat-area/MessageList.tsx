import React, { ForwardedRef } from "react";
import { Message, SidebarUser } from "@/src/store/chat";
import MessageBubble from "../MessageBubble";
import { Badge } from "@/src/components/ui/badge";
import { Loader2 } from "lucide-react";

interface MessageListProps {
  messages: Message[];
  userId: string | undefined;
  isDMView: boolean;
  targetLastReadAt: string | null;
  isLoadingMore: boolean;
  isCurrentlyTyping: boolean;
  selectedUser: SidebarUser | null;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  innerRef: React.RefObject<HTMLDivElement | null>;
}

export const MessageList = React.forwardRef(
  (
    {
      messages,
      userId,
      isDMView,
      targetLastReadAt,
      isLoadingMore,
      isCurrentlyTyping,
      selectedUser,
      onScroll,
      innerRef,
    }: MessageListProps,
    ref: ForwardedRef<HTMLDivElement>,
  ) => {
    return (
      <div
        ref={ref}
        onScroll={onScroll}
        // 🟢 THE FIX: Container must be 'relative' for perfect offsetTop calculation
        className="flex-1 px-4 py-6 overflow-y-auto bg-background custom-scrollbar relative"
      >
        <div ref={innerRef} className="flex flex-col gap-1 relative min-h-full">
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

          {messages.map((msg, index) => {
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const isConsecutive = prevMsg
              ? prevMsg.senderId === msg.senderId &&
                new Date(msg.createdAt).getTime() -
                  new Date(prevMsg.createdAt).getTime() <
                  5 * 60 * 1000
              : false;

            return (
              // 🟢 THE FIX: Data-attribute attached so we can query it directly in DOM
              <div key={msg.id} data-message-id={msg.id} className="w-full">
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

          {isCurrentlyTyping && selectedUser && (
            <div className="text-[13px] font-medium text-muted-foreground pl-14 pt-2 animate-pulse">
              {selectedUser.name.split(" ")[0]} is typing...
            </div>
          )}

          <div id="chat-bottom-anchor" className="h-px w-full shrink-0 mt-2" />
        </div>
      </div>
    );
  },
);

MessageList.displayName = "MessageList";