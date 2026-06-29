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
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (response.ok) {
          const data = await response.json();
          const formattedHistory: Message[] =
            data.messages?.map((msg: any) => ({
              id: msg.id,
              text: msg.content,
              senderId: msg.senderId,
              createdAt: msg.createdAt,
              attachmentUrl: msg.attachmentUrl,
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

    const handleNewMessage = (message: Message) => {
      const currentSelectedUser = chatState().selectedUser;
      const currentRoomId = chatState().activeRoomId;
      const me = authState().user;

      const targetUserId =
        message.senderId === me?.id
          ? currentSelectedUser?.id
          : message.senderId;
      if (targetUserId) chatState().moveUserToTop(targetUserId);

      if (currentSelectedUser?.id === message.senderId) {
        chatState().addMessage(message);
        // Doosra user chat mein active hai, foran server ko parhne ka signal do
        if (currentRoomId)
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

    const handleMessageDeleted = ({ messageId }: { messageId: string }) =>
      chatState().deleteMessage(messageId);

    const handleMessageEdited = ({
      messageId,
      newText,
    }: {
      messageId: string;
      newText: string;
    }) => chatState().editMessage(messageId, newText);

    // 🔵 CLOCK SKEW FIX: Ab hum server ka bheja hua absolute time save kar rahe hain
    const handleMessagesRead = ({
      roomId,
      readAt,
    }: {
      roomId: string;
      readAt: string;
    }) => {
      if (chatState().activeRoomId === roomId) {
        chatState().setTargetLastReadAt(readAt); // Use exact server time
      }
    };

    const handleMessageDelivered = ({ messageId, tempId }: any) =>
      chatState().updateMessageStatus(messageId, "delivered", tempId);
    const handleMessageAck = ({ tempId, realId }: any) =>
      chatState().updateRealMessageId(tempId, realId);

    // BIND
    socket.on("roomJoined", handleRoomJoined);
    socket.on("receiveMessage", handleNewMessage);
    socket.on("message_deleted", handleMessageDeleted);
    socket.on("message_edited", handleMessageEdited);
    socket.on("messagesRead", handleMessagesRead);
    socket.on("messageDelivered", handleMessageDelivered);
    socket.on("messageSentAck", handleMessageAck);

    // UNBIND
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
