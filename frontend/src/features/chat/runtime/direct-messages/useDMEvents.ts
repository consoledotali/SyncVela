import { useEffect } from "react";
import { useChatStore } from "@/src/features/chat/state";
import { useAuthStore } from "@/src/store/authStore";
import { authFetch } from "@/src/lib/authFetch";
import type { Socket } from "socket.io-client";
import type {
  Attachment,
  Message,
  MessageReaction,
} from "@/src/features/chat/state/types";
import {
  createDeliveryReceiptPayload,
  createRoomReceiptPayload,
} from "@/src/features/chat/protocol/socketPayloads";

type DmSocketMessage = {
  id: string;
  content?: string | null;
  senderId: string;
  createdAt: string;
  attachments?: Attachment[];
  sender?: Message["sender"];
  status?: Message["status"];
  tempId?: string;
  conversationId?: string;
  workspaceId?: string | null;
  parentMessageId?: string | null;
  _count?: Message["_count"];
  reactions?: MessageReaction[];
};

type DirectMessageHistoryResponse = {
  messages?: DmSocketMessage[];
  participants?: Array<{ userId: string; lastReadAt?: string | null }>;
  hasMore: boolean;
  nextCursor?: string | null;
};

type MessageDeletedPayload = {
  messageId: string;
  roomId?: string;
  isChannel?: boolean;
  senderId?: string;
  parentMessageId?: string | null;
};

type ReactionUpdatePayload = {
  messageId: string;
  reactions?: MessageReaction[];
};

type DeliveryPayload = { messageId: string; tempId?: string };
type MessageAcknowledgement = { tempId: string; realId: string };

export const useDMEvents = (socket: Socket | null) => {
  useEffect(() => {
    if (!socket) return;
    const chatState = useChatStore.getState;
    const authState = useAuthStore.getState;

    const handleRoomJoined = async (roomId: string) => {
      chatState().setActiveRoomId(roomId);
      const currentSelectedUser = chatState().selectedUser;
      chatState().setLoading(true);

      if (currentSelectedUser) {
        const payload = createRoomReceiptPayload(roomId);
        if (payload) socket.emit("markAsRead", payload);
        chatState().clearUnread(currentSelectedUser.id);
      }

      try {
        const response = await authFetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/messages/dm/${roomId}`,
        );

        if (response.ok) {
          const data = (await response.json()) as DirectMessageHistoryResponse;
          const formattedHistory: Message[] =
            data.messages?.map((msg) => ({
              id: msg.id,
              text: msg.content || "",
              senderId: msg.senderId,
              createdAt: msg.createdAt,
              attachments: msg.attachments || [],
              sender: msg.sender,
              status: msg.status || "delivered",
              _count: msg._count, 
              reactions: msg.reactions || [],
            })) || [];

          chatState().setMessages(formattedHistory);

          if (currentSelectedUser) {
            const targetParticipant = data.participants?.find(
              (participant) => participant.userId === currentSelectedUser.id,
            );
            chatState().setTargetLastReadAt(
              targetParticipant?.lastReadAt || null,
            );
          }
          chatState().setPagination(data.hasMore, data.nextCursor ?? null);
        }
      } catch {
        // A reconnect can race with a room change or a token refresh. The next
        // authorized roomJoined event will hydrate this history; do not emit a
        // user-facing or developer-console error for this transient path.
      } finally {
        chatState().setLoading(false);
      }
    };

    const handleNewMessage = (rawMessage: DmSocketMessage) => {
      const state = chatState();
      const currentSelectedUser = state.selectedUser;
      const currentRoomId = state.activeRoomId;
      const me = authState().user;

      if (rawMessage.parentMessageId) {
        const isDrawerOpenForThisThread =
          state.activeThreadParent?.id === rawMessage.parentMessageId;
        let isDuplicate = false;

        if (isDrawerOpenForThisThread) {
          isDuplicate = state.threadMessages.some(
            (m) =>
              m.id === rawMessage.id ||
              (rawMessage.tempId &&
                (m.tempId === rawMessage.tempId || m.id === rawMessage.tempId)),
          );

          if (isDuplicate) {
            if (rawMessage.tempId) {
              state.updateThreadRealMessageId(rawMessage.tempId, rawMessage.id);
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
              status: "read", // 🚀 The Drawer is Open, message is immediately READ locally
            });

            // 🚀 Force target server to alert sender for Blue Ticks
            const payload = createRoomReceiptPayload(currentRoomId);
            if (payload) socket.emit("markAsRead", payload);
          }
        }

        if (!isDuplicate) {
          // 🚀 Trigger Highlight
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

          if (
            rawMessage.senderId !== me?.id &&
            currentRoomId !== rawMessage.conversationId
          ) {
            state.incrementUnread(rawMessage.senderId);
          }
        }
        return; 
      }

      // FLAT DM MESSAGES FLOW
      const message: Message = {
        id: rawMessage.id,
        text: rawMessage.content || "",
        senderId: rawMessage.senderId,
        createdAt: rawMessage.createdAt,
        attachments: rawMessage.attachments || [],
        sender: rawMessage.sender,
        status: rawMessage.status || "delivered",
        tempId: rawMessage.tempId,
      };

      const targetUserId =
        message.senderId === me?.id
          ? currentSelectedUser?.id
          : message.senderId;
      if (targetUserId) state.moveUserToTop(targetUserId);

      if (
        (currentSelectedUser?.id === message.senderId ||
          message.senderId === me?.id) &&
        (!rawMessage.conversationId ||
          currentRoomId === rawMessage.conversationId)
      ) {
        state.addMessage(message);
        if (currentRoomId && message.senderId !== me?.id) {
          const payload = createRoomReceiptPayload(currentRoomId);
          if (payload) socket.emit("markAsRead", payload);
        }
      } else {
        if (
          !rawMessage.workspaceId ||
          rawMessage.workspaceId === chatState().activeWorkspaceId
        ) {
          state.incrementUnread(message.senderId);
        }
        const payload = createDeliveryReceiptPayload(message.id, message.tempId);
        if (payload) socket.emit("markAsDelivered", payload);
      }
    };

    const handleMessageDeleted = ({
      messageId,
      roomId,
      isChannel,
      senderId,
      parentMessageId,
    }: MessageDeletedPayload) => {
      const state = chatState();
      state.deleteMessage(messageId, parentMessageId);
      if (isChannel && roomId && state.activeChannelId !== roomId) {
        state.decrementChannelUnread(roomId);
      } else if (!isChannel && senderId && state.activeRoomId !== roomId) {
        if (senderId !== authState().user?.id) state.decrementUnread(senderId);
      }
    };

    const handleMessageEdited = ({
      messageId,
      newText,
    }: {
      messageId: string;
      newText: string;
    }) => chatState().editMessage(messageId, newText);

    const handleReactionUpdate = ({
      messageId,
      reactions,
    }: ReactionUpdatePayload) =>
      chatState().updateMessageReactions(messageId, reactions || []);

    const handleMessagesRead = ({
      roomId,
      readAt,
    }: {
      roomId: string;
      readAt: string;
    }) => {
      if (chatState().activeRoomId === roomId)
        chatState().setTargetLastReadAt(readAt);
    };

    const handleMessageDelivered = ({ messageId, tempId }: DeliveryPayload) =>
      chatState().updateMessageStatus(messageId, "delivered", tempId);
    const handleMessageAck = ({ tempId, realId }: MessageAcknowledgement) =>
      chatState().updateRealMessageId(tempId, realId);

    const handleRecipientUnavailable = ({ userId }: { userId: string }) => {
      const state = chatState();
      state.removeUser(userId);
      if (state.selectedUser?.id === userId) {
        state.resetChat();
      }
    };

    const handleReconnect = () => {
      const { selectedUser, activeWorkspaceId } = chatState();
      if (selectedUser) {
        socket.emit("joinPrivateChat", {
          targetUserId: selectedUser.id,
          workspaceId: activeWorkspaceId || undefined,
        });
      }
    };

    socket.on("roomJoined", handleRoomJoined);
    socket.on("receiveMessage", handleNewMessage);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("message_edited", handleMessageEdited);
    socket.on("message_reactions_updated", handleReactionUpdate);
    socket.on("messagesRead", handleMessagesRead);
    socket.on("messageDelivered", handleMessageDelivered);
    socket.on("messageSentAck", handleMessageAck);
    socket.on("dm_recipient_unavailable", handleRecipientUnavailable);
    socket.on("connect", handleReconnect);

    return () => {
      socket.off("roomJoined", handleRoomJoined);
      socket.off("receiveMessage", handleNewMessage);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("message_edited", handleMessageEdited);
      socket.off("message_reactions_updated", handleReactionUpdate);
      socket.off("messagesRead", handleMessagesRead);
      socket.off("messageDelivered", handleMessageDelivered);
      socket.off("messageSentAck", handleMessageAck);
      socket.off("dm_recipient_unavailable", handleRecipientUnavailable);
      socket.off("connect", handleReconnect);
    };
  }, [socket]);
};
