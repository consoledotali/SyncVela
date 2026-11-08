import { useEffect } from "react";
import { useChatStore } from "@/src/store/chatStore";
import { resolveAvatarUrl } from "@/src/utils/avatarUtils";
import type { Socket } from "socket.io-client";

type AvatarUpdatedPayload = { userId: string; avatarUrl: string };
type OnlineUsersPayload = { workspaceId: string; userIds: string[] };
type ChannelTypingPayload = { channelId: string; userId: string };

export const usePresenceEvents = (socket: Socket | null) => {
  const activeWorkspaceId = useChatStore((state) => state.activeWorkspaceId);

  useEffect(() => {
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

    const handleUserOnline = (onlineUserId: string) => {
      const { onlineUsers, setOnlineUsers } = chatState();
      if (!onlineUsers.includes(onlineUserId)) {
        setOnlineUsers([...onlineUsers, onlineUserId]);
      }
    };

    const handleUserOffline = (offlineUserId: string) => {
      const { onlineUsers, setOnlineUsers } = chatState();
      setOnlineUsers(onlineUsers.filter((id) => id !== offlineUserId));
    };

    const handleGetOnlineUsers = (payload: OnlineUsersPayload | string[]) => {
      if (Array.isArray(payload)) {
        chatState().setOnlineUsers(payload);
        return;
      }
      if (payload && payload.workspaceId === chatState().activeWorkspaceId) {
        chatState().setOnlineUsers(payload.userIds);
      }
    };

    const handleAvatarUpdated = ({ userId, avatarUrl }: AvatarUpdatedPayload) => {
      const state = chatState();
      const resolvedAvatarUrl = resolveAvatarUrl(avatarUrl);
      const isSelectedUser = state.selectedUser?.id === userId;

      state.setUsers(
        state.users.map((u) =>
          u.id === userId ? { ...u, avatarUrl: resolvedAvatarUrl } : u,
        ),
      );

      if (isSelectedUser && state.selectedUser) {
        state.setSelectedUser({
          ...state.selectedUser,
          avatarUrl: resolvedAvatarUrl,
        });
      }

      state.setMessages(
        state.messages.map((m) =>
          m.senderId === userId
            ? {
                ...m,
                sender: {
                  id: userId,
                  name: m.sender?.name || "User",
                  avatarUrl: resolvedAvatarUrl,
                },
              }
            : m,
        ),
      );
    };

    socket.on("messagesRead", handleMessagesRead);
    socket.on("userTyping", handleDirectTyping);
    socket.on("userStopTyping", handleDirectStopTyping);
    socket.on("user_typing", handleChannelTyping);
    socket.on("user_stop_typing", handleChannelStopTyping);
    socket.on("userOnline", handleUserOnline);
    socket.on("userOffline", handleUserOffline);
    socket.on("getOnlineUsers", handleGetOnlineUsers);
    socket.on("avatar_updated", handleAvatarUpdated);

    if (activeWorkspaceId) {
      socket.emit("requestOnlineUsers", activeWorkspaceId);
    }

    return () => {
      socket.off("messagesRead", handleMessagesRead);
      socket.off("userTyping", handleDirectTyping);
      socket.off("userStopTyping", handleDirectStopTyping);
      socket.off("user_typing", handleChannelTyping);
      socket.off("user_stop_typing", handleChannelStopTyping);
      socket.off("userOnline", handleUserOnline);
      socket.off("userOffline", handleUserOffline);
      socket.off("getOnlineUsers", handleGetOnlineUsers);
      socket.off("avatar_updated", handleAvatarUpdated);
    };
  }, [socket, activeWorkspaceId]);
};

