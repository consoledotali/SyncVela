import { useEffect } from "react";
import { useAuthStore } from "@/src/store/authStore";
import { useChatStore } from "@/src/store/chat";

export const useChannelHistory = () => {
  const { token } = useAuthStore();
  const { activeChannelId, setMessages, setPagination } = useChatStore();

  useEffect(() => {
    if (!activeChannelId || !token) return;

    const fetchHistory = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/messages/channel/${activeChannelId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (response.ok) {
          const data = await response.json();
          const rawMessages = data.messages || [];

          // 🚀 THE FIX: Strict Mapping for the new Schema
          const formattedMessages = rawMessages.map((msg: any) => ({
            id: msg.id,
            text: msg.content || "",
            senderId: msg.senderId,
            createdAt: msg.createdAt,
            attachments: msg.attachments || [],
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
