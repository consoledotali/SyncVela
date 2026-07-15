import { useEffect } from "react";
import { useChatStore } from "@/src/store/chat";

export const useChannelEvents = (socket: any) => {
  useEffect(() => {
    if (!socket) return;
    const chatState = useChatStore.getState;

    const handleNewChannelMessage = (rawMessage: any) => {
      const currentChannelId = chatState().activeChannelId;

      if (currentChannelId === rawMessage.channelId) {
        const existingMessages = chatState().messages;

        const isDuplicate = existingMessages.some(
          (m) =>
            m.id === rawMessage.id ||
            (rawMessage.tempId &&
              (m.tempId === rawMessage.tempId || m.id === rawMessage.tempId)) ||
            (m.senderId === rawMessage.senderId &&
              (m.text === rawMessage.content ||
                (!rawMessage.content && m.text === " ")) &&
              new Date().getTime() - new Date(m.createdAt).getTime() < 3000),
        );

        if (isDuplicate) {
          if (rawMessage.tempId)
            chatState().updateRealMessageId(rawMessage.tempId, rawMessage.id);
          return;
        }

        // 🚀 THE FIX: Standardize payload
        chatState().addMessage({
          id: rawMessage.id,
          text: rawMessage.content || "",
          senderId: rawMessage.senderId,
          createdAt: rawMessage.createdAt,
          attachments: rawMessage.attachments || [],
          sender: rawMessage.sender,
          status: "sent",
        } as any);

        socket.emit("markChannelAsRead", { channelId: rawMessage.channelId });
      } else {
        chatState().incrementChannelUnread(rawMessage.channelId);
      }
    };

    const handleAddedToChannel = (channel: any) => {
      const state = chatState();
      const currentChannels = state.channels;

      if (!currentChannels.find((c: any) => c.id === channel.id)) {
        state.setChannels([...currentChannels, { ...channel, unreadCount: 0 }]);
        socket.emit("join_channel", channel.id);
      }
    };

    socket.on("receive_channel_message", handleNewChannelMessage);
    socket.on("added_to_channel", handleAddedToChannel);

    return () => {
      socket.off("receive_channel_message", handleNewChannelMessage);
      socket.off("added_to_channel", handleAddedToChannel);
    };
  }, [socket]);
};
