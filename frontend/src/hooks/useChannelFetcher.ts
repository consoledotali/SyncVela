import { useEffect } from "react";
import { useAuthStore } from "@/src/store/authStore";
import { useChatStore } from "@/src/store/chat";

export const useChannelFetcher = () => {
  const { token } = useAuthStore();
  const { activeWorkspaceId, setChannels } = useChatStore();

  useEffect(() => {
    // Agar koi workspace select nahi hua, toh API hit mat maro
    if (!activeWorkspaceId || !token) return;

    const fetchChannels = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/channels/${activeWorkspaceId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          setChannels(data);
        }
      } catch (error) {
        console.error("❌ Failed to fetch channels:", error);
      }
    };

    fetchChannels();
  }, [activeWorkspaceId, token, setChannels]);
};
