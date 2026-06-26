import { useEffect } from "react";
import { useSocket } from "@/src/providers/SocketProvider";
import { useChatStore, Message } from "@/src/store/chat"; // 🛡️ NAYA PATH: Modular store import
import { useAuthStore } from "@/src/store/authStore";

export const useChatSocketEvents = () => {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const chatState = useChatStore.getState;
    const authState = useAuthStore.getState;

    // ==========================================
    // 🔵 1-ON-1 DM HANDLERS
    // ==========================================
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
        if (currentRoomId) {
          socket.emit("markAsRead", {
            roomId: currentRoomId,
            targetUserId: message.senderId,
          });
        }
      } else {
        chatState().incrementUnread(message.senderId);
        socket.emit("markAsDelivered", {
          messageId: message.id,
          senderId: message.senderId,
          tempId: message.tempId,
        });
      }
    };

    // ==========================================
    // 🟢 CHANNEL HANDLERS
    // ==========================================
    const handleNewChannelMessage = (message: any) => {
      const currentChannelId = chatState().activeChannelId;

      if (currentChannelId === message.channelId) {
        const existingMessages = chatState().messages;

        const isDuplicate = existingMessages.some(
          (m) =>
            m.id === message.id ||
            (message.tempId && m.tempId === message.tempId) ||
            (m.senderId === message.senderId &&
              m.text === message.content &&
              new Date().getTime() - new Date(m.createdAt).getTime() < 3000),
        );

        if (isDuplicate) {
          const optimisticMsg = existingMessages.find(
            (m) =>
              m.senderId === message.senderId && m.text === message.content,
          );
          if (optimisticMsg && optimisticMsg.id !== message.id) {
            chatState().updateRealMessageId(optimisticMsg.id, message.id);
          }
          return;
        }

        chatState().addMessage({
          id: message.id,
          text: message.content,
          senderId: message.senderId,
          createdAt: message.createdAt,
          attachmentUrl: message.attachmentUrl,
          sender: message.sender,
        } as any);
      } else {
        // 🛡️ THE NOTIFICATION TRIGGER IS NOW INJECTED
        chatState().incrementChannelUnread(message.channelId);
      }
    };

    // ==========================================
    // 🟡 SHARED PRESENCE & UTILITY HANDLERS
    // ==========================================
    const handleMessagesRead = ({ roomId }: { roomId: string }) => {
      if (chatState().activeRoomId === roomId) {
        chatState().setTargetLastReadAt(new Date().toISOString());
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

    const handleUserOnline = (userId: string) => {
      const currentOnline = chatState().onlineUsers;
      if (!currentOnline.includes(userId))
        chatState().setOnlineUsers([...currentOnline, userId]);
    };

    const handleUserOffline = (userId: string) => {
      chatState().setOnlineUsers(
        chatState().onlineUsers.filter((id) => id !== userId),
      );
    };

    // 🔗 BIND ALL EVENTS
    socket.on("roomJoined", handleRoomJoined);
    socket.on("messagesRead", handleMessagesRead);
    socket.on("receiveMessage", handleNewMessage);
    socket.on("receive_channel_message", handleNewChannelMessage);

    socket.on("userTyping", handleTyping);
    socket.on("userStoppedTyping", handleStopTyping);
    socket.on("getOnlineUsers", (userIds: string[]) =>
      chatState().setOnlineUsers(userIds),
    );
    socket.on("userOnline", handleUserOnline);
    socket.on("userOffline", handleUserOffline);
    socket.on("messageDelivered", handleMessageDelivered);
    socket.on("messageSentAck", handleMessageAck);
    socket.on("disconnect", handleDisconnect);

    socket.emit("requestOnlineUsers");

    return () => {
      socket.off("roomJoined", handleRoomJoined);
      socket.off("messagesRead", handleMessagesRead);
      socket.off("receiveMessage", handleNewMessage);
      socket.off("receive_channel_message", handleNewChannelMessage);
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
