import React from "react";
import { useChatStore, Channel } from "@/src/store/chat";
import { useAuthStore } from "@/src/store/authStore";
import { useSocket } from "@/src/providers/SocketProvider";
import { Hash, Lock, Plus } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import { usePermissions } from "@/src/hooks/usePermissions"; // 🚀 THE RBAC ENGINE IMPORT
import { authFetch } from "@/src/lib/authFetch";

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

  const { token } = useAuthStore();
  const { socket } = useSocket();

  // 🛡️ THE CLEAN UI GATEKEEPER
  // Sirf hook se poocho ke permission hai ya nahi, no spaghetti logic!
  const { hasPermission } = usePermissions();
  const canCreateChannel = hasPermission("CREATE_CHANNEL");

  const handleChannelSelect = async (channel: Channel) => {
    setActiveChannelId(channel.id);
    clearChannelUnread(channel.id);

    if (socket) {
      socket.emit("join_channel", channel.id);
      socket.emit("markChannelAsRead", { channelId: channel.id });
    }

    if (token) {
      try {
        await authFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/channels/mark-read`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ channelId: channel.id }),
        });
      } catch (error) {
        console.error("Failed to sync read state via API", error);
      }
    }
  };

  // 🟢 THE PRODUCTION ENGINE FOR CHANNELS
  const sortedChannels = [...channels].sort((a: any, b: any) => {
    const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;

    const aCount =
      channelUnreadCounts[a.id] !== undefined
        ? channelUnreadCounts[a.id]
        : a.unreadCount || 0;
    const bCount =
      channelUnreadCounts[b.id] !== undefined
        ? channelUnreadCounts[b.id]
        : b.unreadCount || 0;

    if (timeA !== timeB && (timeA > 0 || timeB > 0)) {
      return timeB - timeA;
    }

    if (aCount !== bCount) {
      return bCount - aCount;
    }

    return a.name.localeCompare(b.name);
  });

  return (
    <div className="mb-4">
      <div className="mt-4 mb-1 px-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Channels
        </h3>
        {/* 🛡️ CONDITIONALLY RENDER BASED ON RBAC */}
        {canCreateChannel && (
          <button
            onClick={onOpenModal}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            title="Create Channel"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        {sortedChannels.length === 0 ? (
          <p className="text-[11px] text-muted-foreground px-2 py-1 italic">
            No channels yet.
          </p>
        ) : (
          sortedChannels.map((c: any) => {
            const isActive = activeChannelId === c.id;
            const storeCount = channelUnreadCounts[c.id];
            const unreadCount =
              storeCount !== undefined ? storeCount : c.unreadCount || 0;
            const isUnread = unreadCount > 0 && !isActive;

            return (
              <div
                key={c.id}
                onClick={() => handleChannelSelect(c)}
                className={`flex justify-between items-center px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-bold"
                    : isUnread
                      ? "hover:bg-muted/60 text-foreground font-bold"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground font-medium"
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  {c.type === "PRIVATE" ? (
                    <Lock
                      className={`h-3.5 w-3.5 ${isUnread ? "text-foreground" : "opacity-80"}`}
                    />
                  ) : (
                    <Hash
                      className={`h-4 w-4 ${isUnread ? "text-foreground" : "opacity-80"}`}
                    />
                  )}
                  <span
                    className={`truncate text-sm ${isUnread ? "font-bold text-foreground" : ""}`}
                  >
                    {c.name}
                  </span>
                </div>
                {isUnread && (
                  <Badge
                    variant="destructive"
                    className="h-4 min-w-4 flex items-center justify-center rounded-full px-1 text-[9px] shrink-0 font-bold"
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

