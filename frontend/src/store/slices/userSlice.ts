import { StateCreator } from "zustand";
import type { ChatStore, UserSlice } from "@/src/types/storeTypes";

export const createUserSlice: StateCreator<ChatStore, [], [], UserSlice> = (
  set,
) => ({
  users: [],
  onlineUsers: [],
  unreadCounts: {},
  channelUnreadCounts: {},

  setUsers: (users) => set({ users }),
  removeUser: (userId) =>
    set((state) => {
      const users = state.users.filter((user) => user.id !== userId);
      const unreadCounts = { ...state.unreadCounts };
      delete unreadCounts[userId];
      return {
        users,
        unreadCounts,
        onlineUsers: state.onlineUsers.filter((id) => id !== userId),
      };
    }),
  setOnlineUsers: (userIds) =>
    set({ onlineUsers: [...new Set(userIds.map(String))] }),

  incrementUnread: (userId) =>
    set((state) => {
      const currentTime = new Date().toISOString();
      return {
        unreadCounts: {
          ...state.unreadCounts,
          [userId]: (state.unreadCounts[userId] || 0) + 1,
        },
        users: state.users.map((u) =>
          u.id === userId ? { ...u, lastMessageAt: currentTime } : u,
        ),
      };
    }),

  clearUnread: (userId) =>
    set((state) => ({ unreadCounts: { ...state.unreadCounts, [userId]: 0 } })),

  incrementChannelUnread: (channelId) =>
    set((state) => {
      const currentTime = new Date().toISOString();
      return {
        channelUnreadCounts: {
          ...state.channelUnreadCounts,
          [channelId]: (state.channelUnreadCounts[channelId] || 0) + 1,
        },
        channels: state.channels.map((c) =>
          c.id === channelId ? { ...c, lastMessageAt: currentTime } : c,
        ),
      };
    }),

  clearChannelUnread: (channelId) =>
    set((state) => ({
      channelUnreadCounts: { ...state.channelUnreadCounts, [channelId]: 0 },
    })),

  moveUserToTop: (userId) =>
    set((state) => {
      const userIndex = state.users.findIndex((u) => u.id === userId);
      if (userIndex <= 0) return state;
      const newUsersList = [...state.users];
      const extractedUser = newUsersList.splice(userIndex, 1)[0];
      newUsersList.unshift({ ...extractedUser });
      return { users: newUsersList };
    }),

  decrementUnread: (userId) =>
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [userId]: Math.max(0, (state.unreadCounts[userId] || 0) - 1),
      },
    })),

  decrementChannelUnread: (channelId) =>
    set((state) => ({
      channelUnreadCounts: {
        ...state.channelUnreadCounts,
        [channelId]: Math.max(
          0,
          (state.channelUnreadCounts[channelId] || 0) - 1,
        ),
      },
    })),

  updateUserActivity: (userId, timestamp) =>
    set((state) => ({
      users: state.users.map((u) =>
        u.id === userId ? { ...u, lastMessageAt: timestamp } : u,
      ),
    })),
});

