import { StateCreator } from "zustand";
import { ChatStore, ChatUISlice } from "./types";

export const createChatUISlice: StateCreator<ChatStore, [], [], ChatUISlice> = (
  set,
) => ({
  selectedUser: null,
  activeRoomId: null,
  isLoading: false,
  typingUsers: [],
  targetLastReadAt: null,

  setSelectedUser: (user) =>
    set((state) => ({
      selectedUser: user,
      activeChannelId: null,
      messages: [],
      activeRoomId: null,
      targetLastReadAt: null,
      hasMore: false,
      nextCursor: null,
      unreadCounts: { ...state.unreadCounts, [user?.id || ""]: 0 },
    })),
  setActiveRoomId: (id) => set({ activeRoomId: id }),
  setLoading: (status) => set({ isLoading: status }),
  addTypingUser: (userId) =>
    set((state) => ({
      typingUsers: state.typingUsers.includes(userId)
        ? state.typingUsers
        : [...state.typingUsers, userId],
    })),
  removeTypingUser: (userId) =>
    set((state) => ({
      typingUsers: state.typingUsers.filter((id) => id !== userId),
    })),
  setTargetLastReadAt: (time) => set({ targetLastReadAt: time }),

  resetChat: () =>
    set({
      workspaces: [],
      channels: [],
      activeWorkspaceId: null,
      activeChannelId: null,
      users: [],
      selectedUser: null,
      messages: [],
      onlineUsers: [],
      unreadCounts: {},
      channelUnreadCounts: {},
      activeRoomId: null,
      hasMore: false,
      nextCursor: null,
      isLoadingMore: false,
      targetLastReadAt: null,
    }),
});
