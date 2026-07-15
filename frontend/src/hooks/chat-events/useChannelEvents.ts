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

    // 🟢 THE INVITE RADAR
    const handleAddedToChannel = (channel: any) => {
      const state = chatState();
      const currentChannels = state.channels;

      if (!currentChannels.find((c: any) => c.id === channel.id)) {
        state.setChannels([...currentChannels, { ...channel, unreadCount: 0 }]);
        socket.emit("join_channel", channel.id);
      }
    };

    // 🚀 THE REAL-TIME CREATION RADAR FIX
    const handleChannelCreated = (channel: any) => {
      const state = chatState();

      // Ensure user is currently in the same workspace before adding the channel
      if (state.activeWorkspaceId === channel.workspaceId) {
        const currentChannels = state.channels;
        if (!currentChannels.find((c: any) => c.id === channel.id)) {
          state.setChannels([
            ...currentChannels,
            { ...channel, unreadCount: 0 },
          ]);
          socket.emit("join_channel", channel.id);
        }
      }
    };

    // BIND LISTENERS
    socket.on("receive_channel_message", handleNewChannelMessage);
    socket.on("added_to_channel", handleAddedToChannel);
    socket.on("channel_created", handleChannelCreated);

    return () => {
      // UNBIND LISTENERS
      socket.off("receive_channel_message", handleNewChannelMessage);
      socket.off("added_to_channel", handleAddedToChannel);
      socket.off("channel_created", handleChannelCreated);
    };
  }, [socket]);
};
