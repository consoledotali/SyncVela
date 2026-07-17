import { useEffect } from "react";
import { useChatStore } from "@/src/store/chat";
import { useAuthStore } from "@/src/store/authStore";

export const useChannelEvents = (socket: any) => {
  useEffect(() => {
    if (!socket) return;
    const chatState = useChatStore.getState;
    const authState = useAuthStore.getState;

    const handleNewChannelMessage = (rawMessage: any) => {
      const state = chatState();
      const currentChannelId = state.activeChannelId;
      const currentUser = authState().user;

      // 🚀 THE BULLETPROOF PAYLOAD EXTRACTOR
      // Backend agar property ka naam badal kar bhi bheje toh frontend catch kar lega
      const targetChannelId = rawMessage.channelId || rawMessage.roomId;

      if (!targetChannelId) return;

      if (currentChannelId === targetChannelId) {
        // 🚀 THREAD INTELLIGENCE ROUTER
        if (rawMessage.parentMessageId) {
          const isDrawerOpenForThisThread =
            state.activeThreadParent?.id === rawMessage.parentMessageId;
          let isDuplicate = false;

          if (isDrawerOpenForThisThread) {
            isDuplicate = state.threadMessages.some(
              (m) =>
                m.id === rawMessage.id ||
                (rawMessage.tempId &&
                  (m.tempId === rawMessage.tempId ||
                    m.id === rawMessage.tempId)),
            );

            if (isDuplicate) {
              if (rawMessage.tempId) {
                state.updateThreadRealMessageId(
                  rawMessage.tempId,
                  rawMessage.id,
                );
              }
            } else {
              state.addThreadReply({
                id: rawMessage.id,
                text: rawMessage.content || "",
                senderId: rawMessage.senderId,
                createdAt: rawMessage.createdAt,
                attachments: rawMessage.attachments || [],
                sender: rawMessage.sender,
                status: "sent",
              } as any);
            }
          }

          if (!isDuplicate) {
            // Flash Highlight Tracker
            state.setHighlightedMessage(rawMessage.parentMessageId);
            setTimeout(() => {
              useChatStore.getState().setHighlightedMessage(null);
            }, 3000);

            useChatStore.setState((prev) => ({
              messages: prev.messages.map((m) =>
                m.id === rawMessage.parentMessageId
                  ? { ...m, _count: { replies: (m._count?.replies || 0) + 1 } }
                  : m,
              ),
              activeThreadParent:
                prev.activeThreadParent?.id === rawMessage.parentMessageId
                  ? ({
                      ...prev.activeThreadParent,
                      _count: {
                        replies:
                          (prev.activeThreadParent!._count?.replies || 0) + 1,
                      },
                    } as any)
                  : prev.activeThreadParent,
            }));
          }
          return;
        }

        // NORMAL MAIN CHAT MESSAGES FLOW
        const existingMessages = state.messages;
        const isDuplicateMain = existingMessages.some(
          (m) =>
            m.id === rawMessage.id ||
            (rawMessage.tempId &&
              (m.tempId === rawMessage.tempId || m.id === rawMessage.tempId)) ||
            (m.senderId === rawMessage.senderId &&
              (m.text === rawMessage.content ||
                (!rawMessage.content && m.text === " ")) &&
              new Date().getTime() - new Date(m.createdAt).getTime() < 3000),
        );

        if (isDuplicateMain) {
          if (rawMessage.tempId)
            state.updateRealMessageId(rawMessage.tempId, rawMessage.id);
          return;
        }

        state.addMessage({
          id: rawMessage.id,
          text: rawMessage.content || "",
          senderId: rawMessage.senderId,
          createdAt: rawMessage.createdAt,
          attachments: rawMessage.attachments || [],
          sender: rawMessage.sender,
          status: "sent",
        } as any);

        socket.emit("markChannelAsRead", { channelId: targetChannelId });
      } else {
        // 🚀 THE IDENTITY SHIELD & UNLOCKER
        // Ab har thread reply ya normal message par badge barhega, BASHARTE wo message kisi aur ne bheja ho!
        if (rawMessage.senderId !== currentUser?.id) {
          chatState().incrementChannelUnread(targetChannelId);
        }
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

    const handleChannelCreated = (channel: any) => {
      const state = chatState();

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

    const handleMessageDeleted = (payload: any) => {
      const { messageId, roomId, isChannel } = payload;
      const state = chatState();

      state.deleteMessage(messageId);

      if (isChannel && roomId && state.activeChannelId !== roomId) {
        state.decrementChannelUnread(roomId);
      }
    };

    const handleMessageEdited = (payload: any) => {
      chatState().editMessage(payload.messageId, payload.newText);
    };

    socket.on("receive_channel_message", handleNewChannelMessage);
    socket.on("added_to_channel", handleAddedToChannel);
    socket.on("channel_created", handleChannelCreated);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("message_edited", handleMessageEdited);

    return () => {
      socket.off("receive_channel_message", handleNewChannelMessage);
      socket.off("added_to_channel", handleAddedToChannel);
      socket.off("channel_created", handleChannelCreated);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("message_edited", handleMessageEdited);
    };
  }, [socket]);
};
