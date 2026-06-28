import { useEffect } from "react";
import { useSocket } from "@/src/providers/SocketProvider";
import { useChatStore, Message } from "@/src/store/chat";
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
          }
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
              status: msg.status || "delivered", // Historical messages fallback
            })) || [];

          chatState().setMessages(formattedHistory);

          if (currentSelectedUser) {
            const targetParticipant = data.participants?.find(
              (p: any) => p.userId === currentSelectedUser.id
            );
            chatState().setTargetLastReadAt(
              targetParticipant?.lastReadAt || null
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

        // The Deduplication Engine
        const isDuplicate = existingMessages.some(
          (m) =>
            m.id === message.id ||
            (message.tempId && (m.tempId === message.tempId || m.id === message.tempId)) ||
            (m.senderId === message.senderId &&
              (m.text === message.content || (!message.content && m.text === " ")) &&
              new Date().getTime() - new Date(m.createdAt).getTime() < 3000)
        );

        if (isDuplicate) {
          if (message.tempId) {
            chatState().updateRealMessageId(message.tempId, message.id);
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
          status: "sent",
        } as any);
      } else {
        chatState().incrementChannelUnread(message.channelId);
      }
    };

    // ==========================================
    // 🔴 DELETION HANDLER
    // ==========================================
    const handleMessageDeleted = ({ messageId }: { messageId: string }) => {
      chatState().deleteMessage(messageId);
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
    
    const handleMessageDelivered = ({ messageId, tempId }: { messageId: string; tempId?: string }) =>
      chatState().updateMessageStatus(messageId, "delivered", tempId);
    
    const handleMessageAck = ({ tempId, realId }: { tempId: string; realId: string }) =>
      chatState().updateRealMessageId(tempId, realId);
    
    const handleDisconnect = () => chatState().setOnlineUsers([]);

    const handleUserOnline = (userId: string) => {
      const chatStateData = chatState();
      const currentOnline = chatStateData.onlineUsers;
      
      if (!currentOnline.includes(userId)) {
        chatState().setOnlineUsers([...currentOnline, userId]);
      }

      // 🛡️ Backfill Delivery: Upgrade "sent" to "delivered" when target comes online
      if (chatStateData.selectedUser?.id === userId) {
        const updatedMessages = chatStateData.messages.map((msg) => {
          if (msg.senderId !== userId && msg.status === "sent") {
            return { ...msg, status: "delivered" as const };
          }
          return msg;
        });
        chatState().setMessages(updatedMessages);
      }
    };

    const handleUserOffline = (userId: string) => {
      chatState().setOnlineUsers(
        chatState().onlineUsers.filter((id) => id !== userId)
      );
    };

    // 🔗 BIND ALL EVENTS
    socket.on("roomJoined", handleRoomJoined);
    socket.on("messagesRead", handleMessagesRead);
    socket.on("receiveMessage", handleNewMessage);
    socket.on("receive_channel_message", handleNewChannelMessage);
    socket.on("message_deleted", handleMessageDeleted);

    socket.on("userTyping", handleTyping);
    socket.on("userStoppedTyping", handleStopTyping);
    socket.on("getOnlineUsers", (userIds: string[]) =>
      chatState().setOnlineUsers(userIds)
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
      socket.off("message_deleted", handleMessageDeleted);
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