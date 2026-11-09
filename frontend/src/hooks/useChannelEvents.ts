import { useEffect } from "react";
import { useChatStore } from "@/src/store/chatStore";
import { useAuthStore } from "@/src/store/authStore";
import { authFetch } from "@/src/utils/apiUtils";
import type { Socket } from "socket.io-client";
import type { Channel } from "@/src/types/channelTypes";
import type {
  Attachment,
  Message,
  MessageReaction,
} from "@/src/types/messageTypes";

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

export const useChannelEvents = (socket: Socket | null) => {
  useEffect(() => {
    if (!socket) return;

    const chatState = useChatStore.getState;

    const handleNewMessage = (message: ChannelSocketMessage) => {
      const state = chatState();
      const currentUserId = useAuthStore.getState().user?.id;
      const targetChannelId = message.channelId || message.roomId;

      if (!targetChannelId) return;

      if (message.parentMessageId) {
        const replyMessage: Message = {
          id: message.id,
          text: message.content ?? "",
          senderId: message.senderId,
          createdAt: message.createdAt,
          attachments: message.attachments || [],
          sender: message.sender,
          status: "delivered",
          parentMessageId: message.parentMessageId,
        };

        if (state.activeThreadParent?.id === message.parentMessageId) {
          state.addThreadReply(replyMessage);
        }

        if (
          state.activeChannelId === targetChannelId &&
          message.senderId !== currentUserId
        ) {
          socket.emit("markChannelAsRead", { channelId: targetChannelId });
        }
        return;
      }

      const formattedMessage: Message = {
        id: message.id,
        text: message.content ?? "",
        senderId: message.senderId,
        createdAt: message.createdAt,
        status: "delivered",
        tempId: message.tempId,
        attachments: message.attachments || [],
        sender: message.sender,
        parentMessageId: message.parentMessageId,
      };

      if (state.activeChannelId === targetChannelId) {
        state.addMessage(formattedMessage);
        state.updateChannelActivity(targetChannelId, message.createdAt);

        if (message.senderId !== currentUserId) {
          socket.emit("markChannelAsRead", { channelId: targetChannelId });
        }
      } else {
        state.incrementChannelUnread(targetChannelId);
        state.updateChannelActivity(targetChannelId, message.createdAt);
      }
    };

    const handleChannelCreated = (newChannel: Channel) => {
      const state = chatState();
      if (state.activeWorkspaceId === newChannel.workspaceId) {
        const exists = state.channels.some((c) => c.id === newChannel.id);
        if (!exists) {
          state.setChannels([...state.channels, newChannel]);
          socket.emit("join_channel", newChannel.id);
        }
      }
    };

    const handleChannelDeleted = ({ channelId }: { channelId: string }) => {
      const state = chatState();
      const updatedChannels = state.channels.filter((c) => c.id !== channelId);
      state.setChannels(updatedChannels);

      if (state.activeChannelId === channelId) {
        const remainingPublic = updatedChannels.find(
          (c) => c.type === "PUBLIC",
        );
        state.setActiveChannelId(
          remainingPublic ? remainingPublic.id : null,
        );
        state.setMessages([]);
      }
    };

    const handleChannelMessageSent = ({
      tempId,
      messageId,
      parentMessageId,
    }: {
      tempId: string;
      messageId: string;
      parentMessageId?: string | null;
    }) => {
      const state = chatState();
      state.updateRealMessageId(tempId, messageId);
      state.updateMessageStatus(messageId, "sent", tempId);
      if (parentMessageId) {
        state.updateThreadRealMessageId(tempId, messageId);
      }
    };

    const handleChannelMessageDeleted = ({
      messageId,
      isChannel,
      parentMessageId,
    }: MessageDeletedPayload) => {
      if (!isChannel) return;
      chatState().deleteMessage(messageId, parentMessageId);
    };

    const handleChannelMessageEdited = ({
      messageId,
      newText,
    }: MessageEditedPayload) => {
      chatState().editMessage(messageId, newText);
    };

    const handleChannelReactionUpdated = ({
      messageId,
      reactions,
    }: ReactionUpdatePayload) => {
      chatState().updateMessageReactions(messageId, reactions || []);
    };

    const handleChannelThreadParentUpdated = ({
      parentMessageId,
      replyCount,
    }: ThreadParentUpdatedPayload) => {
      chatState().setThreadReplyCount(parentMessageId, replyCount);
    };

    const handleChannelAccessUpdated = async (
      data: ChannelAccessUpdatedPayload,
    ) => {
      const state = chatState();
      if (state.activeWorkspaceId !== data.workspaceId) return;

      if (!data.visible) {
        state.setChannels(
          state.channels.filter((channel) => channel.id !== data.channelId),
        );
        if (state.activeChannelId === data.channelId) {
          const fallback = state.channels.find(
            (channel) =>
              channel.id !== data.channelId && channel.type === "PUBLIC",
          );
          state.setActiveChannelId(fallback?.id ?? null);
        }
        return;
      }

      try {
        const response = await authFetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/channels/${data.workspaceId}`,
        );
        if (!response.ok) return;

        const channels = (await response.json()) as Channel[];
        state.setChannels(channels);

        const restoredChannel = channels.find(
          (channel) => channel.id === data.channelId,
        );
        if (restoredChannel) {
          socket.emit("join_channel", restoredChannel.id);
        }
      } catch (error) {
        console.error("Failed to re-sync channel access", error);
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

    socket.on("new_message", handleNewMessage);
    socket.on("channel_created", handleChannelCreated);
    socket.on("channel_deleted", handleChannelDeleted);
    socket.on("channel_message_sent", handleChannelMessageSent);
    socket.on("channelMessageDeleted", handleChannelMessageDeleted);
    socket.on("channelMessageEdited", handleChannelMessageEdited);
    socket.on("channel_reaction_updated", handleChannelReactionUpdated);
    socket.on("channelThreadParentUpdated", handleChannelThreadParentUpdated);
    socket.on("channel_access_updated", handleChannelAccessUpdated);
    socket.on("channel_owner_updated", handleChannelOwnerUpdated);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("channel_created", handleChannelCreated);
      socket.off("channel_deleted", handleChannelDeleted);
      socket.off("channel_message_sent", handleChannelMessageSent);
      socket.off("channelMessageDeleted", handleChannelMessageDeleted);
      socket.off("channelMessageEdited", handleChannelMessageEdited);
      socket.off("channel_reaction_updated", handleChannelReactionUpdated);
      socket.off(
        "channelThreadParentUpdated",
        handleChannelThreadParentUpdated,
      );
      socket.off("channel_access_updated", handleChannelAccessUpdated);
      socket.off("channel_owner_updated", handleChannelOwnerUpdated);
    };
  }, [socket]);
};

