import { useEffect } from "react";
import { useAuthStore } from "@/src/store/authStore";
import { useChatStore } from "@/src/store/chat";
import { useSocket } from "@/src/providers/SocketProvider";

export const useChannelFetcher = () => {
  const { token } = useAuthStore();
  const { activeWorkspaceId, setChannels } = useChatStore();
  const { socket } = useSocket(); // 🟢 ADDED SOCKET

  useEffect(() => {
    if (!activeWorkspaceId || !token) return;

    const fetchChannels = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/channels/${activeWorkspaceId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (response.ok) {
          const data = await response.json();
          setChannels(data);

          const counts: Record<string, number> = {};
          data.forEach((c: any) => {
            if (c.unreadCount > 0) counts[c.id] = c.unreadCount;

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
  }, [activeWorkspaceId, token, setChannels, socket]);
};

