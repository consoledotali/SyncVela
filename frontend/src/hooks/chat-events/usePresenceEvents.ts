import { useEffect } from "react";
import { useChatStore } from "@/src/store/chat";

export const usePresenceEvents = (socket: any) => {
  useEffect(() => {
    // Agar socket prop nahi aaya toh hook safely return kar jayega
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

    // 🚀 REAL-TIME GLOBAL AVATAR HOT-SWAP INTERCEPTOR
    const handleAvatarUpdated = ({
      userId,
      avatarUrl,
    }: {
      userId: string;
      avatarUrl: string;
    }) => {
      const state = chatState();
      const currentTimestamp = new Date().getTime();
      const dynamicCacheBustedUrl = `${avatarUrl}?t=${currentTimestamp}`;

      // 1. Sidebar ke direct users list records hydrator sync
      const updatedUsers = state.users.map((u) =>
        u.id === userId ? { ...u, avatarUrl: dynamicCacheBustedUrl } : u,
      );

      // 2. Main active chat frame context checker
      const updatedSelectedUser =
        state.selectedUser?.id === userId
          ? { ...state.selectedUser, avatarUrl: dynamicCacheBustedUrl }
          : state.selectedUser;

      useChatStore.setState({
        users: updatedUsers,
        selectedUser: updatedSelectedUser,
      });

      // 3. Current active stream cache refresh force loop
      useChatStore.setState((prev) => ({
        messages: prev.messages.map((m) =>
          m.senderId === userId && m.sender
            ? ({
                ...m,
                sender: { ...m.sender, avatarUrl: dynamicCacheBustedUrl },
              } as any)
            : m,
        ),
        threadMessages: prev.threadMessages.map((m) =>
          m.senderId === userId && m.sender
            ? ({
                ...m,
                sender: { ...m.sender, avatarUrl: dynamicCacheBustedUrl },
              } as any)
            : m,
        ),
        activeThreadParent:
          prev.activeThreadParent?.senderId === userId &&
          prev.activeThreadParent?.sender
            ? ({
                ...prev.activeThreadParent,
                sender: {
                  ...prev.activeThreadParent.sender,
                  avatarUrl: dynamicCacheBustedUrl,
                },
              } as any)
            : prev.activeThreadParent,
      }));
    };

    // Events Binding
    socket.on("messagesRead", handleMessagesRead);
    socket.on("userTyping", handleTyping);
    socket.on("userStoppedTyping", handleStopTyping);
    socket.on("getOnlineUsers", (userIds: string[]) =>
      chatState().setOnlineUsers(userIds),
    );
    socket.on("userOnline", handleUserOnline);
    socket.on("userOffline", handleUserOffline);
    socket.on("user_avatar_updated", handleAvatarUpdated);
    socket.on("disconnect", handleDisconnect);

    return () => {
      // Cleanup Engine
      socket.off("messagesRead", handleMessagesRead);
      socket.off("userTyping", handleTyping);
      socket.off("userStoppedTyping", handleStopTyping);
      socket.off("getOnlineUsers");
      socket.off("userOnline", handleUserOnline);
      socket.off("userOffline", handleUserOffline);
      socket.off("user_avatar_updated", handleAvatarUpdated);
      socket.off("disconnect", handleDisconnect);
    };
  }, [socket]);
};
