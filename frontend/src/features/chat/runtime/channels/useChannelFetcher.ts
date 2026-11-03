import { useEffect } from "react";
import { useAuthStore } from "@/src/store/authStore";
import { useChatStore } from "@/src/features/chat/state";
import { useSocket } from "@/src/providers/SocketProvider";
import { authFetch } from "@/src/lib/authFetch";
import type { Channel } from "@/src/features/chat/state/types";

type ChannelWithUnread = Channel & { unreadCount?: number };

export const useChannelFetcher = () => {
  const { token } = useAuthStore();
  const { activeWorkspaceId, setChannels } = useChatStore();
  const { socket } = useSocket(); // 🟢 ADDED SOCKET

  useEffect(() => {
    if (!activeWorkspaceId || !token) return;

    const fetchChannels = async () => {
      try {
        const response = await authFetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/channels/${activeWorkspaceId}`,
        );

        if (response.ok) {
          const data = (await response.json()) as ChannelWithUnread[];
          setChannels(data);

          const counts: Record<string, number> = {};
          data.forEach((c) => {
            if (c.unreadCount && c.unreadCount > 0) {
              counts[c.id] = c.unreadCount;
            }

            // 🛡️ THE DEAF SOCKET FIX: Join ALL channels in the background immediately!
            if (socket) {
              socket.emit("join_channel", c.id);
            }
          });

          useChatStore.setState((state) => ({
            channelUnreadCounts: { ...state.channelUnreadCounts, ...counts },
          }));
        }
      } catch (error) {
        console.error("❌ Failed to fetch channels:", error);
      }
    };

    fetchChannels();

    // A reconnect creates a new server-side socket, so previously joined
    // channel rooms no longer exist. Rehydrate the sidebar and rejoin every
    // channel to avoid silently missing message and reaction broadcasts.
    socket?.on("connect", fetchChannels);

    return () => {
      socket?.off("connect", fetchChannels);
    };
  }, [activeWorkspaceId, token, setChannels, socket]);
};

