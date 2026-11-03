import { useEffect } from "react";
import { useAuthStore } from "@/src/store/authStore";
import { useChatStore } from "@/src/features/chat/state";
import { useSocket } from "@/src/providers/SocketProvider";
import { authFetch } from "@/src/lib/authFetch";
import type {
  Attachment,
  Message,
  MessageReaction,
} from "@/src/features/chat/state/types";

type ChannelHistoryMessage = {
  id: string;
  content?: string | null;
  senderId: string;
  createdAt: string;
  attachments?: Attachment[];
  sender?: Message["sender"];
  _count?: Message["_count"];
  reactions?: MessageReaction[];
};

type ChannelHistoryResponse = {
  messages?: ChannelHistoryMessage[];
  hasMore?: boolean;
  nextCursor?: string | null;
};

export const useChannelHistory = () => {
  const { token } = useAuthStore();
  const { activeChannelId, setMessages, setPagination, setLoading } = useChatStore();
  const { socket } = useSocket();

  useEffect(() => {
    if (!activeChannelId || !token) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const response = await authFetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/messages/channel/${activeChannelId}`,
        );

        if (response.ok) {
          const data = (await response.json()) as ChannelHistoryResponse;
          const rawMessages = data.messages || [];

          // 🚀 THE FIX: Strict Mapping for the new Schema
          const formattedMessages: Message[] = rawMessages.map((msg) => ({
            id: msg.id,
            text: msg.content || "",
            senderId: msg.senderId,
            createdAt: msg.createdAt,
            attachments: msg.attachments || [],
            sender: msg.sender,
            _count: msg._count,
            reactions: msg.reactions || [],
          }));

          setMessages(formattedMessages);
          setPagination(data.hasMore || false, data.nextCursor || null);
        }
      } catch (error) {
        console.error("❌ Failed to load channel history", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();

    socket?.on("connect", fetchHistory);

    return () => {
      socket?.off("connect", fetchHistory);
    };
  }, [activeChannelId, token, setMessages, setPagination, setLoading, socket]);
};

