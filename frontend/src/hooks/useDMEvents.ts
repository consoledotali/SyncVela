import { useEffect } from "react";
import { useChatStore } from "@/src/store/chatStore";
import { useAuthStore } from "@/src/store/authStore";
import { authFetch } from "@/src/utils/apiUtils";
import type { Socket } from "socket.io-client";
import type {
  Attachment,
  Message,
  MessageReaction,
} from "@/src/types/messageTypes";
import {
  createDeliveryReceiptPayload,
  createRoomReceiptPayload,
} from "@/src/utils/socketUtils";

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

export const useDMEvents = (socket: Socket | null) => {
  useEffect(() => {
    if (!socket) return;

    const chatState = useChatStore.getState;

    const handleRoomAssigned = ({ roomId }: { roomId: string }) => {
      chatState().setActiveRoomId(roomId);
      socket.emit("join_room", roomId);
    };

    const handleReceiveMessage = (message: DmSocketMessage) => {
      const state = chatState();
      const currentUserId = useAuthStore.getState().user?.id;
      const isChannelView = Boolean(state.activeChannelId);

      if (
        message.workspaceId &&
        message.workspaceId !== state.activeWorkspaceId
      ) {
        return;
      }

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

        const isCurrentlyInRoom =
          !isChannelView &&
          state.selectedUser &&
          state.activeRoomId === message.conversationId;

        if (isCurrentlyInRoom) {
          socket.emit(
            "markAsRead",
            createRoomReceiptPayload(state.activeRoomId),
          );
        }
        return;
      }

      const formattedMessage: Message = {
        id: message.id,
        text: message.content ?? "",
        senderId: message.senderId,
        createdAt: message.createdAt,
        status: message.status || "delivered",
        tempId: message.tempId,
        attachments: message.attachments || [],
        sender: message.sender,
        parentMessageId: message.parentMessageId,
        _count: message._count,
        reactions: message.reactions || [],
      };

      const isCurrentConversation =
        !isChannelView &&
        state.selectedUser &&
        (state.selectedUser.id === message.senderId ||
          message.senderId === currentUserId);

      if (isCurrentConversation) {
        state.addMessage(formattedMessage);
        state.moveUserToTop(message.senderId);

        if (message.senderId !== currentUserId) {
          const roomIdToMark = message.conversationId || state.activeRoomId;
          socket.emit("markAsRead", createRoomReceiptPayload(roomIdToMark));
        }
      } else if (message.senderId !== currentUserId) {
        state.incrementUnread(message.senderId);
        state.moveUserToTop(message.senderId);
      }

      if (message.senderId !== currentUserId) {
        socket.emit(
          "messageDelivered",
          createDeliveryReceiptPayload(message.id, message.tempId),
        );
      }
    };

    const handleMessageSent = ({
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

    const handleMessageStatus = ({
      messageId,
      status,
    }: {
      messageId: string;
      status: Message["status"];
    }) => {
      if (!status) return;
      chatState().updateMessageStatus(messageId, status);
    };

    const handleMessageDeleted = ({
      messageId,
      isChannel,
      parentMessageId,
    }: MessageDeletedPayload) => {
      if (isChannel) return;
      chatState().deleteMessage(messageId, parentMessageId);
    };

    const handleMessageEdited = ({
      messageId,
      newText,
    }: MessageEditedPayload) => {
      chatState().editMessage(messageId, newText);
    };

    const handleReactionUpdated = ({
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

    socket.on("room_assigned", handleRoomAssigned);
    socket.on("receive_message", handleReceiveMessage);
    socket.on("message_sent", handleMessageSent);
    socket.on("message_status", handleMessageStatus);
    socket.on("messageDeleted", handleMessageDeleted);
    socket.on("messageEdited", handleMessageEdited);
    socket.on("reaction_updated", handleReactionUpdated);
    socket.on("threadParentUpdated", handleThreadParentUpdated);

    return () => {
      socket.off("room_assigned", handleRoomAssigned);
      socket.off("receive_message", handleReceiveMessage);
      socket.off("message_sent", handleMessageSent);
      socket.off("message_status", handleMessageStatus);
      socket.off("messageDeleted", handleMessageDeleted);
      socket.off("messageEdited", handleMessageEdited);
      socket.off("reaction_updated", handleReactionUpdated);
      socket.off("threadParentUpdated", handleThreadParentUpdated);
    };
  }, [socket]);

  useEffect(() => {
    const selectedUserId = useChatStore.getState().selectedUser?.id;
    if (!selectedUserId) return;

    let isMounted = true;

    const fetchDirectMessages = async () => {
      const { setMessages, setActiveRoomId, setPagination, setLoading } =
        useChatStore.getState();
      setLoading(true);

      try {
        const response = await authFetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/messages/direct/${selectedUserId}`,
        );

        if (response.ok && isMounted) {
          const data = await response.json();
          const rawMessages = data.messages || [];

          const formattedMessages: Message[] = rawMessages.map(
            (msg: DmSocketMessage) => ({
              id: msg.id,
              text: msg.content ?? "",
              senderId: msg.senderId,
              createdAt: msg.createdAt,
              status: msg.status || "delivered",
              attachments: msg.attachments || [],
              sender: msg.sender,
              _count: msg._count,
              reactions: msg.reactions || [],
            }),
          );

          setMessages(formattedMessages);
          setPagination(Boolean(data.hasMore), data.nextCursor || null);

          if (data.roomId) {
            setActiveRoomId(data.roomId);
            if (socket) {
              socket.emit("join_room", data.roomId);
              socket.emit(
                "markAsRead",
                createRoomReceiptPayload(data.roomId),
              );
            }
          }
        }
      } catch (error) {
        console.error("âŒ Failed to fetch direct messages:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDirectMessages();

    return () => {
      isMounted = false;
    };
  }, [socket]);
};

