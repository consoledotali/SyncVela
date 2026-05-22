import { useEffect } from "react";
import { useSocket } from "@/src/providers/SocketProvider";
import { useChatStore, Message } from "@/src/store/chatStore";
import { useAuthStore } from "@/src/store/authStore";

export const useChatSocketEvents = () => {
  const { socket } = useSocket();

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
        const response = await fetch(
          `http://localhost:5000/api/chat/${roomId}/messages`,
        );
        if (response.ok) {
          const data = await response.json();
          const formattedHistory: Message[] = data.messages.map((msg: any) => ({
            id: msg.id,
            text: msg.content,
            senderId: msg.senderId,
            createdAt: msg.createdAt,
            attachmentUrl: msg.attachmentUrl,
          }));
          chatState().setMessages(formattedHistory);

          if (currentSelectedUser) {
            const targetParticipant = data.participants.find(
              (p: any) => p.userId === currentSelectedUser.id,
            );
            chatState().setTargetLastReadAt(
              targetParticipant?.lastReadAt || null,
            );
          }
          chatState().setPagination(data.hasMore, data.nextCursor);
        }
      } catch (error) {
        console.error("❌ Failed to fetch room history", error);
      }
    };

    const handleMessagesRead = ({ roomId }: { roomId: string }) => {
      if (chatState().activeRoomId === roomId) {
        chatState().setTargetLastReadAt(new Date().toISOString());
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

    const handleTyping = ({ senderId }: { senderId: string }) =>
      chatState().addTypingUser(senderId);

    const handleStopTyping = ({ senderId }: { senderId: string }) =>
      chatState().removeTypingUser(senderId);

    const handleMessageDelivered = ({
      messageId,
      tempId,
    }: {
      messageId: string;
      tempId?: string;
    }) => chatState().updateMessageStatus(messageId, "delivered", tempId);

    const handleMessageAck = ({
      tempId,
      realId,
    }: {
      tempId: string;
      realId: string;
    }) => chatState().updateRealMessageId(tempId, realId);

    const handleDisconnect = () => chatState().setOnlineUsers([]);

    // 🛡️ THE PRESENCE FIX: Real-time update handlers
    const handleUserOnline = (userId: string) => {
      const currentOnline = chatState().onlineUsers;
      if (!currentOnline.includes(userId)) {
        chatState().setOnlineUsers([...currentOnline, userId]);
      }
    };

    const handleUserOffline = (userId: string) => {
      chatState().setOnlineUsers(
        chatState().onlineUsers.filter((id) => id !== userId),
      );
    };

    // Binding the events
    socket.on("roomJoined", handleRoomJoined);
    socket.on("messagesRead", handleMessagesRead);
    socket.on("receiveMessage", handleNewMessage);
    socket.on("userTyping", handleTyping);
    socket.on("userStoppedTyping", handleStopTyping);
    socket.on("getOnlineUsers", (userIds: string[]) =>
      chatState().setOnlineUsers(userIds),
    );

    // Applying the new handlers
    socket.on("userOnline", handleUserOnline);
    socket.on("userOffline", handleUserOffline);

    socket.on("messageDelivered", handleMessageDelivered);
    socket.on("messageSentAck", handleMessageAck);
    socket.on("disconnect", handleDisconnect);

    // 🛡️ THE PRESENCE FIX: Request online users immediately after connecting
    socket.emit("requestOnlineUsers");

    // Unbinding logic to prevent ghost listeners
    return () => {
      socket.off("roomJoined", handleRoomJoined);
      socket.off("messagesRead", handleMessagesRead);
      socket.off("receiveMessage", handleNewMessage);
      socket.off("userTyping", handleTyping);
      socket.off("userStoppedTyping", handleStopTyping);
      socket.off("getOnlineUsers");

      socket.off("userOnline", handleUserOnline);
      socket.off("userOffline", handleUserOffline);

      socket.off("messageDelivered", handleMessageDelivered);
      socket.off("messageSentAck", handleMessageAck);
      socket.off("disconnect", handleDisconnect);
    };
  }, [socket]);
};
