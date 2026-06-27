import { useEffect } from "react";
import { useAuthStore } from "@/src/store/authStore";
import { useChatStore } from "@/src/store/chat"; // 🛡️ Modular path ensure kiya hai

export const useChannelHistory = () => {
  const { token } = useAuthStore();
  const { activeChannelId, setMessages, setPagination } = useChatStore();

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
          const data = await response.json();

          // 🛡️ THE DATA PIPELINE FIX: Data object ke andar se 'messages' array nikalo
          const rawMessages = data.messages || [];

          const formattedMessages = rawMessages.map((msg: any) => ({
            id: msg.id,
            text: msg.content,
            senderId: msg.senderId,
            createdAt: msg.createdAt,
            attachmentUrl: msg.attachmentUrl,
            sender: msg.sender,
          }));

          setMessages(formattedMessages);

          setPagination(data.hasMore || false, data.nextCursor || null);
        }
      } catch (error) {
        console.error("❌ Failed to load channel history", error);
      }
    };

    fetchHistory();
  }, [activeChannelId, token, setMessages, setPagination]);
};
