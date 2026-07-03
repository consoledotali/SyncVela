import { StateCreator } from "zustand";
import { ChatStore, UserSlice } from "./types";

export const createUserSlice: StateCreator<ChatStore, [], [], UserSlice> = (
  set,
) => ({
  users: [],
  onlineUsers: [],
  unreadCounts: {},
  channelUnreadCounts: {},

  setUsers: (users) => set({ users }),
  setOnlineUsers: (userIds) => set({ onlineUsers: userIds }),

  // 🟢 THE BULLETPROOF FIX: Jab badge barhay ga, time bhi automatically update hoga!
  incrementUnread: (userId) =>
    set((state) => {
      const currentTime = new Date().toISOString();
      return {
        unreadCounts: {
          ...state.unreadCounts,
          [userId]: (state.unreadCounts[userId] || 0) + 1,
        },
        // User ki array mein jao aur us shakhs ka aakhri time abhi ka set kar do
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

  // Explicit time updater (agar bina badge ke time update karna ho)
  updateUserActivity: (userId, timestamp) =>
    set((state) => ({
      users: state.users.map((u) =>
        u.id === userId ? { ...u, lastMessageAt: timestamp } : u,
      ),
    })),
});
