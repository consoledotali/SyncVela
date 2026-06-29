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
      } else {
        chatState().incrementChannelUnread(message.channelId);
      }
    };

    socket.on("receive_channel_message", handleNewChannelMessage);
    return () => socket.off("receive_channel_message", handleNewChannelMessage);
  }, [socket]);
};
