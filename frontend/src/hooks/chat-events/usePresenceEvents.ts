import { useEffect } from "react";
import { useChatStore } from "@/src/store/chat";

export const usePresenceEvents = (socket: any) => {
  useEffect(() => {
    if (!socket) return;
    const chatState = useChatStore.getState;

    const handleMessagesRead = ({ roomId }: { roomId: string }) => {
      if (chatState().activeRoomId === roomId)
        chatState().setTargetLastReadAt(new Date().toISOString());
    };

    const handleTyping = ({ senderId }: { senderId: string }) =>
      chatState().addTypingUser(senderId);
    const handleStopTyping = ({ senderId }: { senderId: string }) =>
      chatState().removeTypingUser(senderId);
    const handleDisconnect = () => chatState().setOnlineUsers([]);

    const handleUserOnline = (userId: string) => {
      const chatStateData = chatState();
      const currentOnline = chatStateData.onlineUsers;

      if (!currentOnline.includes(userId))
        chatState().setOnlineUsers([...currentOnline, userId]);

      // Backfill Delivery Sync
      if (chatStateData.selectedUser?.id === userId) {
        const updatedMessages = chatStateData.messages.map((msg) => {
          if (msg.senderId !== userId && msg.status === "sent")
            return { ...msg, status: "delivered" as const };
          return msg;
        });
        chatState().setMessages(updatedMessages);
      }
    };

    const handleUserOffline = (userId: string) => {
      chatState().setOnlineUsers(
        chatState().onlineUsers.filter((id) => id !== userId),
      );
    };

    socket.on("messagesRead", handleMessagesRead);
    socket.on("userTyping", handleTyping);
    socket.on("userStoppedTyping", handleStopTyping);
    socket.on("getOnlineUsers", (userIds: string[]) =>
      chatState().setOnlineUsers(userIds),
    );
    socket.on("userOnline", handleUserOnline);
    socket.on("userOffline", handleUserOffline);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("messagesRead", handleMessagesRead);
      socket.off("userTyping", handleTyping);
      socket.off("userStoppedTyping", handleStopTyping);
      socket.off("getOnlineUsers");
      socket.off("userOnline", handleUserOnline);
      socket.off("userOffline", handleUserOffline);
      socket.off("disconnect", handleDisconnect);
    };
  }, [socket]);
};
