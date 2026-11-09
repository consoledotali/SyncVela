import { useEffect } from "react";
import { useAuthStore } from "@/src/store/authStore";
import { useChatStore } from "@/src/store/chatStore";
import { useSocket } from "@/src/providers/SocketProvider";
import { authFetch } from "@/src/utils/apiUtils";
import type { Channel, ChannelWithUnread } from "@/src/types/channelTypes";

export const useChannelFetcher = () => {
  const { token } = useAuthStore();
  const { activeWorkspaceId, setChannels } = useChatStore();
  const { socket } = useSocket();

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

            if (socket) {
              socket.emit("join_channel", c.id);
            }
          });

          useChatStore.setState((state) => ({
            channelUnreadCounts: { ...state.channelUnreadCounts, ...counts },
          }));
        }
      } catch (error) {
        console.error("âŒ Failed to fetch channels:", error);
      }
    };

    fetchChannels();
  }, [activeWorkspaceId, token, setChannels, socket]);
};

