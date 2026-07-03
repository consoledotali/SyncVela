import { useEffect } from "react";
import { useChatStore } from "@/src/store/chat";

export const useChannelEvents = (socket: any) => {
  useEffect(() => {
    if (!socket) return;
    const chatState = useChatStore.getState;

    const handleNewChannelMessage = (message: any) => {
      const currentChannelId = chatState().activeChannelId;

      if (currentChannelId === message.channelId) {
        const existingMessages = chatState().messages;

        const isDuplicate = existingMessages.some(
          (m) =>
            m.id === message.id ||
            (message.tempId &&
              (m.tempId === message.tempId || m.id === message.tempId)) ||
            (m.senderId === message.senderId &&
              (m.text === message.content ||
                (!message.content && m.text === " ")) &&
              new Date().getTime() - new Date(m.createdAt).getTime() < 3000),
        );

        if (isDuplicate) {
          if (message.tempId)
            chatState().updateRealMessageId(message.tempId, message.id);
          return;
        }

        chatState().addMessage({
          id: message.id,
          text: message.content,
          senderId: message.senderId,
          createdAt: message.createdAt,
          attachmentUrl: message.attachmentUrl,
          sender: message.sender,
          status: "sent",
        } as any);

        socket.emit("markChannelAsRead", { channelId: message.channelId });
      } else {
        chatState().incrementChannelUnread(message.channelId);
      }
    };

    // 🟢 THE RADAR FIX: Naya channel receive karna
    const handleAddedToChannel = (channel: any) => {
      const state = chatState();
      const currentChannels = state.channels;

      if (!currentChannels.find((c: any) => c.id === channel.id)) {
        state.setChannels([...currentChannels, { ...channel, unreadCount: 0 }]);

        // Background mein automatically socket room join karo
        socket.emit("join_channel", channel.id);
      }
    };

    socket.on("receive_channel_message", handleNewChannelMessage);
    socket.on("added_to_channel", handleAddedToChannel); // 🟢 BIND

    return () => {
      socket.off("receive_channel_message", handleNewChannelMessage);
      socket.off("added_to_channel", handleAddedToChannel); // 🟢 UNBIND
    };
  }, [socket]);
};
