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

  incrementUnread: (userId) =>
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [userId]: (state.unreadCounts[userId] || 0) + 1,
      },
    })),
  clearUnread: (userId) =>
    set((state) => ({ unreadCounts: { ...state.unreadCounts, [userId]: 0 } })),

  incrementChannelUnread: (channelId) =>
    set((state) => ({
      channelUnreadCounts: {
        ...state.channelUnreadCounts,
        [channelId]: (state.channelUnreadCounts[channelId] || 0) + 1,
      },
    })),
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
});
