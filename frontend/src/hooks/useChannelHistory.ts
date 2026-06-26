import { useEffect } from "react";
import { useAuthStore } from "@/src/store/authStore";
import { useChatStore } from "@/src/store/chat";

export const useChannelHistory = () => {
  const { token } = useAuthStore();
  const { activeChannelId, setMessages } = useChatStore();

  useEffect(() => {
    if (!activeChannelId || !token) return;

    const fetchHistory = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/messages/channel/${activeChannelId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (response.ok) {
          const rawMessages = await response.json();

          // 🛡️ THE DATA MAPPING FIX: Backend uses 'content', UI expects 'text'
          const formattedMessages = rawMessages.map((msg: any) => ({
            id: msg.id,
            text: msg.content,
            senderId: msg.senderId,
            createdAt: msg.createdAt,
            attachmentUrl: msg.attachmentUrl,
            sender: msg.sender,
          }));

          setMessages(formattedMessages);
        }
      } catch (error) {
        console.error("❌ Failed to load channel history", error);
      }
    };

    fetchHistory();
  }, [activeChannelId, token, setMessages]);
};
