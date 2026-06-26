import React from "react";
import { useChatStore, Channel } from "@/src/store/chat";
import { useSocket } from "@/src/providers/SocketProvider";
import { Hash, Lock, Plus } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";

interface ChannelListProps {
  onOpenModal: () => void;
}

export default function ChannelList({ onOpenModal }: ChannelListProps) {
  const {
    channels,
    activeChannelId,
    setActiveChannelId,
    channelUnreadCounts,
    clearChannelUnread,
  } = useChatStore();
  const { socket } = useSocket();

  const handleChannelSelect = (channel: Channel) => {
    setActiveChannelId(channel.id);
    clearChannelUnread(channel.id);
    if (socket) {
      socket.emit("join_channel", channel.id);
    }
  };

  return (
    <div className="mb-4">
      <div className="mt-4 mb-1 px-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Channels
        </h3>
        <button
          onClick={onOpenModal}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          title="Create Channel"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-0.5">
        {channels.length === 0 ? (
          <p className="text-[11px] text-muted-foreground px-2 py-1 italic">
            No channels yet.
          </p>
        ) : (
          channels.map((c) => {
            const isActive = activeChannelId === c.id;
            const unreadCount = channelUnreadCounts[c.id] || 0;

            return (
              <div
                key={c.id}
                onClick={() => handleChannelSelect(c)}
                className={`flex justify-between items-center px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-bold"
                    : unreadCount > 0
                      ? "hover:bg-muted/60"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground font-medium"
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  {c.type === "PRIVATE" ? (
                    <Lock
                      className={`h-3.5 w-3.5 ${unreadCount > 0 && !isActive ? "text-foreground" : ""}`}
                    />
                  ) : (
                    <Hash
                      className={`h-4 w-4 ${unreadCount > 0 && !isActive ? "text-foreground" : ""}`}
                    />
                  )}
                  <span
                    className={`truncate text-sm ${unreadCount > 0 && !isActive ? "font-bold text-foreground" : ""}`}
                  >
                    {c.name}
                  </span>
                </div>
                {unreadCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="h-4 min-w-4 flex items-center justify-center rounded-full px-1 text-[9px] shrink-0"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
