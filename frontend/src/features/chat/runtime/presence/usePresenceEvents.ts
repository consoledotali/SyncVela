import { useEffect } from "react";
import { useChatStore } from "../../state";
import { resolveAvatarUrl } from "@/src/lib/avatarUrl";
import type { Socket } from "socket.io-client";

type AvatarUpdatedPayload = { userId: string; avatarUrl: string };
type OnlineUsersPayload = { workspaceId: string; userIds: string[] };
type ChannelTypingPayload = { channelId: string; userId: string };

export const usePresenceEvents = (socket: Socket | null) => {
  const activeWorkspaceId = useChatStore((state) => state.activeWorkspaceId);

  useEffect(() => {
    // Agar socket prop nahi aaya toh hook safely return kar jayega
    if (!socket) return;

    const chatState = useChatStore.getState;

    const handleMessagesRead = ({ roomId }: { roomId: string }) => {
      if (chatState().activeRoomId === roomId)
        chatState().setTargetLastReadAt(new Date().toISOString());
    };

    const typingExpiryMs = 4_500;
    const setExpiringTypingParticipant = (conversationKey: string, userId: string) => {
      const expiresAt = Date.now() + typingExpiryMs;
      chatState().setTypingParticipant(conversationKey, userId, expiresAt);
      window.setTimeout(() => {
        const expiresAtNow = chatState().typingParticipants[conversationKey]?.[userId];
        if (expiresAtNow && expiresAtNow <= Date.now()) {
          chatState().removeTypingParticipant(conversationKey, userId);
        }
      }, typingExpiryMs + 25);
    };

    const handleDirectTyping = ({ senderId }: { senderId: string }) => {
      const state = chatState();
      if (String(state.selectedUser?.id) !== String(senderId)) return;
      setExpiringTypingParticipant(`dm:${String(senderId)}`, String(senderId));
    };

    const handleDirectStopTyping = ({ senderId }: { senderId: string }) => {
      const state = chatState();
      if (String(state.selectedUser?.id) !== String(senderId)) return;
      state.removeTypingParticipant(`dm:${String(senderId)}`, String(senderId));
    };

    const handleChannelTyping = ({ channelId, userId }: ChannelTypingPayload) =>
      setExpiringTypingParticipant(`channel:${channelId}`, String(userId));

    const handleChannelStopTyping = ({ channelId, userId }: ChannelTypingPayload) =>
      chatState().removeTypingParticipant(`channel:${channelId}`, String(userId));

    const normalizeUserIds = (userIds: string[]) =>
      [...new Set(userIds.map(String))];
    // Keep the last authoritative snapshot while a transport reconnects. The server sends
    // explicit offline events for real disconnects and a fresh workspace snapshot on reconnect.
    const handleDisconnect = () => undefined;
    const requestOnlineUsers = () => {
      if (activeWorkspaceId) socket.emit("requestOnlineUsers", activeWorkspaceId);
    };

    const handleUserOnline = (userId: string) => {
      const normalizedUserId = String(userId);
      const chatStateData = chatState();
      const currentOnline = chatStateData.onlineUsers;

      if (!currentOnline.includes(normalizedUserId))
        chatState().setOnlineUsers([...currentOnline, normalizedUserId]);

      // Backfill Delivery Sync
      if (String(chatStateData.selectedUser?.id) === normalizedUserId) {
        const updatedMessages = chatStateData.messages.map((msg) => {
          if (String(msg.senderId) !== normalizedUserId && msg.status === "sent")
            return { ...msg, status: "delivered" as const };
          return msg;
        });
        chatState().setMessages(updatedMessages);
      }
    };

    const handleUserOffline = (userId: string) => {
      const normalizedUserId = String(userId);
      chatState().setOnlineUsers(
        chatState().onlineUsers.filter((id) => String(id) !== normalizedUserId),
      );
    };

    // 🚀 REAL-TIME GLOBAL AVATAR HOT-SWAP INTERCEPTOR
    const handleAvatarUpdated = ({ userId, avatarUrl }: AvatarUpdatedPayload) => {
      const state = chatState();
      const currentTimestamp = new Date().getTime();
      const canonicalAvatarUrl = resolveAvatarUrl(avatarUrl) || avatarUrl;
      const cacheSeparator = canonicalAvatarUrl.includes("?") ? "&" : "?";
      const dynamicCacheBustedUrl = `${canonicalAvatarUrl}${cacheSeparator}t=${currentTimestamp}`;

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
            ? {
                ...m,
                sender: { ...m.sender, avatarUrl: dynamicCacheBustedUrl },
              }
            : m,
        ),
        threadMessages: prev.threadMessages.map((m) =>
          m.senderId === userId && m.sender
            ? {
                ...m,
                sender: { ...m.sender, avatarUrl: dynamicCacheBustedUrl },
              }
            : m,
        ),
        activeThreadParent:
          prev.activeThreadParent?.senderId === userId &&
          prev.activeThreadParent?.sender
            ? {
                ...prev.activeThreadParent,
                sender: {
                  ...prev.activeThreadParent.sender,
                  avatarUrl: dynamicCacheBustedUrl,
                },
              }
            : prev.activeThreadParent,
      }));
    };

    // Events Binding
    socket.on("messagesRead", handleMessagesRead);
    socket.on("userTyping", handleDirectTyping);
    socket.on("userStoppedTyping", handleDirectStopTyping);
    socket.on("channel_typing", handleChannelTyping);
    socket.on("channel_stop_typing", handleChannelStopTyping);
    const handleOnlineUsers = (payload: OnlineUsersPayload | string[]) => {
      const state = chatState();
      if (Array.isArray(payload)) {
        state.setOnlineUsers(normalizeUserIds(payload));
        return;
      }
      if (String(payload.workspaceId) === String(state.activeWorkspaceId)) {
        state.setOnlineUsers(normalizeUserIds(payload.userIds));
      }
    };

    socket.on("getOnlineUsers", handleOnlineUsers);
    socket.on("userOnline", handleUserOnline);
    socket.on("userOffline", handleUserOffline);
    socket.on("user_avatar_updated", handleAvatarUpdated);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect", requestOnlineUsers);
    requestOnlineUsers();

    return () => {
      // Cleanup Engine
      socket.off("messagesRead", handleMessagesRead);
      socket.off("userTyping", handleDirectTyping);
      socket.off("userStoppedTyping", handleDirectStopTyping);
      socket.off("channel_typing", handleChannelTyping);
      socket.off("channel_stop_typing", handleChannelStopTyping);
      socket.off("getOnlineUsers", handleOnlineUsers);
      socket.off("userOnline", handleUserOnline);
      socket.off("userOffline", handleUserOffline);
      socket.off("user_avatar_updated", handleAvatarUpdated);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect", requestOnlineUsers);
    };
  }, [activeWorkspaceId, socket]);
};
