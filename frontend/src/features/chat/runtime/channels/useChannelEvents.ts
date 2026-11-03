import { useEffect } from "react";
import { useChatStore } from "@/src/features/chat/state";
import { useAuthStore } from "@/src/store/authStore";
import { authFetch } from "@/src/lib/authFetch";
import type { Socket } from "socket.io-client";
import type {
  Attachment,
  Channel,
  Message,
  MessageReaction,
} from "@/src/features/chat/state/types";

type ChannelSocketMessage = {
  id: string;
  channelId?: string;
  roomId?: string;
  parentMessageId?: string | null;
  tempId?: string;
  content?: string | null;
  senderId: string;
  createdAt: string;
  attachments?: Attachment[];
  sender?: Message["sender"];
};

type MessageDeletedPayload = {
  messageId: string;
  roomId?: string;
  isChannel?: boolean;
  parentMessageId?: string | null;
};

type MessageEditedPayload = { messageId: string; newText: string };
type ReactionUpdatePayload = {
  messageId: string;
  reactions?: MessageReaction[];
};
type ThreadParentUpdatedPayload = {
  parentMessageId: string;
  replyCount: number;
};
type ChannelAccessUpdatedPayload = {
  channelId: string;
  workspaceId: string;
  visible: boolean;
};
type ChannelOwnerUpdatedPayload = {
  channelId: string;
  workspaceId: string;
  ownerId: string;
};
type ChannelDeletedPayload = {
  channelId: string;
  channelName: string;
  workspaceId: string;
};

export const useChannelEvents = (socket: Socket | null) => {
  useEffect(() => {
    if (!socket) return;
    const chatState = useChatStore.getState;
    const authState = useAuthStore.getState;

    const handleNewChannelMessage = (rawMessage: ChannelSocketMessage) => {
      const state = chatState();
      const currentChannelId = state.activeChannelId;
      const currentUser = authState().user;

      // 🚀 THE BULLETPROOF PAYLOAD EXTRACTOR
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
                parentMessageId: rawMessage.parentMessageId,
                status: "sent",
              });
            }
          }

          if (!isDuplicate) {
            // Flash Highlight Tracker
            state.setHighlightedMessage(rawMessage.parentMessageId);
            setTimeout(() => {
              useChatStore.getState().setHighlightedMessage(null);
            }, 3000);

            useChatStore.setState((prev) => {
              const activeThreadParent = prev.activeThreadParent;
              let updatedThreadParent = activeThreadParent;

              if (
                activeThreadParent &&
                activeThreadParent.id === rawMessage.parentMessageId
              ) {
                updatedThreadParent = {
                  ...activeThreadParent,
                  _count: {
                    replies: (activeThreadParent._count?.replies || 0) + 1,
                  },
                };
              }

              return {
                messages: prev.messages.map((message) =>
                  message.id === rawMessage.parentMessageId
                    ? {
                        ...message,
                        _count: {
                          replies: (message._count?.replies || 0) + 1,
                        },
                      }
                    : message,
                ),
                activeThreadParent: updatedThreadParent,
              };
            });
          }
          return;
        }

        // NORMAL MAIN CHAT MESSAGES FLOW
        // The store reconciles by authoritative id/tempId. Do not use a
        // text/time heuristic here: two legitimate messages may contain the
        // same text, while an attachment send must replace its optimistic row.
        state.addMessage({
          id: rawMessage.id,
          tempId: rawMessage.tempId,
          text: rawMessage.content || "",
          senderId: rawMessage.senderId,
          createdAt: rawMessage.createdAt,
          attachments: rawMessage.attachments || [],
          sender: rawMessage.sender,
          status: "sent",
        });

        socket.emit("markChannelAsRead", { channelId: targetChannelId });
      } else {
        // 🚀 THE IDENTITY SHIELD & UNLOCKER
        if (rawMessage.senderId !== currentUser?.id) {
          chatState().incrementChannelUnread(targetChannelId);
        }
      }
    };

    // 🚀 EXPLICIT INVITE HANDLER (This fires when Owner uses "Add Members")
    const handleAddedToChannel = (channel: Channel) => {
      const state = chatState();
      const currentChannels = state.channels;

      if (!currentChannels.find((current) => current.id === channel.id)) {
        state.setChannels([...currentChannels, channel]);
        socket.emit("join_channel", channel.id);
      }
    };

    // 🚀 GENERAL BROADCAST HANDLER
    const handleChannelCreated = (channel: Channel) => {
      const state = chatState();

      // 🚨 THE GUEST ISOLATION FIX FOR REAL-TIME
      // Agar current user GUEST hai, toh is general broadcast ko strictly ignore karo
      if (state.currentUserRole === "GUEST") {
        return;
      }

      if (state.activeWorkspaceId === channel.workspaceId) {
        const currentChannels = state.channels;
        if (!currentChannels.find((current) => current.id === channel.id)) {
          state.setChannels([...currentChannels, channel]);
          socket.emit("join_channel", channel.id);
        }
      }
    };

    const handleMessageDeleted = (payload: MessageDeletedPayload) => {
      const { messageId, roomId, isChannel, parentMessageId } = payload;
      const state = chatState();

      state.deleteMessage(messageId, parentMessageId);

      if (isChannel && roomId && state.activeChannelId !== roomId) {
        state.decrementChannelUnread(roomId);
      }
    };

    const handleMessageEdited = (payload: MessageEditedPayload) => {
      chatState().editMessage(payload.messageId, payload.newText);
    };

    const handleReactionUpdate = ({
      messageId,
      reactions,
    }: ReactionUpdatePayload) => {
      chatState().updateMessageReactions(messageId, reactions || []);
    };

    const handleThreadParentUpdated = ({
      parentMessageId,
      replyCount,
    }: ThreadParentUpdatedPayload) => {
      chatState().setThreadReplyCount(parentMessageId, replyCount);
    };

    const handleChannelAccessUpdated = async ({
      channelId,
      workspaceId,
      visible,
    }: ChannelAccessUpdatedPayload) => {
      const state = chatState();
      if (state.activeWorkspaceId !== workspaceId) return;

      try {
        const response = await authFetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/channels/${workspaceId}`,
        );
        if (!response.ok) return;

        const channels = (await response.json()) as Channel[];
        chatState().setChannels(channels);
        channels.forEach((channel) => socket.emit("join_channel", channel.id));

        if (!visible && chatState().activeChannelId === channelId) {
          chatState().setActiveChannelId(null);
          chatState().setMessages([]);
          chatState().closeThread();
        }
      } catch (error) {
        console.error("Failed to refresh channel access", error);
      }
    };

    const handleChannelOwnerUpdated = ({
      channelId,
      workspaceId,
      ownerId,
    }: ChannelOwnerUpdatedPayload) => {
      const state = chatState();
      if (state.activeWorkspaceId !== workspaceId) return;
      state.setChannels(
        state.channels.map((channel) =>
          channel.id === channelId ? { ...channel, ownerId } : channel,
        ),
      );
    };

    const handleChannelDeleted = ({
      channelId,
      workspaceId,
    }: ChannelDeletedPayload) => {
      const state = chatState();
      if (state.activeWorkspaceId !== workspaceId) return;

      const isKnownChannel = state.channels.some(
        (channel) => channel.id === channelId,
      );
      if (!isKnownChannel && state.activeChannelId !== channelId) return;

      socket.emit("leave_channel", channelId);
      state.setChannels(
        state.channels.filter((channel) => channel.id !== channelId),
      );

      const channelUnreadCounts = { ...state.channelUnreadCounts };
      delete channelUnreadCounts[channelId];
      const typingParticipants = { ...state.typingParticipants };
      delete typingParticipants[`channel:${channelId}`];
      useChatStore.setState({ channelUnreadCounts, typingParticipants });

      if (state.activeChannelId === channelId) {
        state.setActiveChannelId(null);
      }
    };

    socket.on("receive_channel_message", handleNewChannelMessage);
    socket.on("added_to_channel", handleAddedToChannel);
    socket.on("channel_created", handleChannelCreated);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("message_edited", handleMessageEdited);
    socket.on("message_reactions_updated", handleReactionUpdate);
    socket.on("thread_parent_updated", handleThreadParentUpdated);
    socket.on("channel_access_updated", handleChannelAccessUpdated);
    socket.on("channel_owner_updated", handleChannelOwnerUpdated);
    socket.on("channel_deleted", handleChannelDeleted);

    return () => {
      socket.off("receive_channel_message", handleNewChannelMessage);
      socket.off("added_to_channel", handleAddedToChannel);
      socket.off("channel_created", handleChannelCreated);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("message_edited", handleMessageEdited);
      socket.off("message_reactions_updated", handleReactionUpdate);
      socket.off("thread_parent_updated", handleThreadParentUpdated);
      socket.off("channel_access_updated", handleChannelAccessUpdated);
      socket.off("channel_owner_updated", handleChannelOwnerUpdated);
      socket.off("channel_deleted", handleChannelDeleted);
    };
  }, [socket]);
};
