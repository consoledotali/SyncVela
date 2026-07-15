import { useEffect } from "react";
import { useChatStore, Message } from "@/src/store/chat";
import { useAuthStore } from "@/src/store/authStore";

export const useDMEvents = (socket: any) => {
  useEffect(() => {
    if (!socket) return;
    const chatState = useChatStore.getState;
    const authState = useAuthStore.getState;

    const handleRoomJoined = async (roomId: string) => {
      chatState().setActiveRoomId(roomId);
      const currentSelectedUser = chatState().selectedUser;

      if (currentSelectedUser) {
        socket.emit("markAsRead", {
          roomId,
          targetUserId: currentSelectedUser.id,
        });
        chatState().clearUnread(currentSelectedUser.id);
      }

      try {
        const token = authState().token;
        const response = await fetch(
          `http://localhost:5000/api/messages/dm/${roomId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (response.ok) {
          const data = await response.json();
          // 🚀 THE FIX: Strict Data Normalization
          const formattedHistory: Message[] =
            data.messages?.map((msg: any) => ({
              id: msg.id,
              text: msg.content || "",
              senderId: msg.senderId,
              createdAt: msg.createdAt,
              attachments: msg.attachments || [],
              sender: msg.sender,
              status: msg.status || "delivered",
            })) || [];

          chatState().setMessages(formattedHistory);

          if (currentSelectedUser) {
            const targetParticipant = data.participants?.find(
              (p: any) => p.userId === currentSelectedUser.id,
            );
            chatState().setTargetLastReadAt(
              targetParticipant?.lastReadAt || null,
            );
          }
          chatState().setPagination(data.hasMore, data.nextCursor);
        }
      } catch (error) {
        console.error("❌ Failed to fetch DM history", error);
      }
    };

    const handleNewMessage = (rawMessage: any) => {
      const currentSelectedUser = chatState().selectedUser;
      const currentRoomId = chatState().activeRoomId;
      const me = authState().user;

      // 🚀 Standardization
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
      if (targetUserId) chatState().moveUserToTop(targetUserId);

      if (
        currentSelectedUser?.id === message.senderId ||
        message.senderId === me?.id
      ) {
        if (message.senderId === me?.id || currentRoomId) {
          chatState().addMessage(message);
        }
        if (currentRoomId && message.senderId !== me?.id)
          socket.emit("markAsRead", {
            roomId: currentRoomId,
            targetUserId: message.senderId,
          });
      } else {
        chatState().incrementUnread(message.senderId);
        socket.emit("markAsDelivered", {
          messageId: message.id,
          senderId: message.senderId,
          tempId: message.tempId,
        });
      }
    };

    const handleMessageDeleted = ({
      messageId,
      roomId,
      isChannel,
      senderId,
    }: any) => {
      const state = chatState();
      state.deleteMessage(messageId);
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

    const handleMessageDelivered = ({ messageId, tempId }: any) =>
      chatState().updateMessageStatus(messageId, "delivered", tempId);
    const handleMessageAck = ({ tempId, realId }: any) =>
      chatState().updateRealMessageId(tempId, realId);

    socket.on("roomJoined", handleRoomJoined);
    socket.on("receiveMessage", handleNewMessage);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("message_edited", handleMessageEdited);
    socket.on("messagesRead", handleMessagesRead);
    socket.on("messageDelivered", handleMessageDelivered);
    socket.on("messageSentAck", handleMessageAck);

    return () => {
      socket.off("roomJoined", handleRoomJoined);
      socket.off("receiveMessage", handleNewMessage);
      socket.off("message_deleted", handleMessageDeleted);
      socket.off("message_edited", handleMessageEdited);
      socket.off("messagesRead", handleMessagesRead);
      socket.off("messageDelivered", handleMessageDelivered);
      socket.off("messageSentAck", handleMessageAck);
    };
  }, [socket]);
};
