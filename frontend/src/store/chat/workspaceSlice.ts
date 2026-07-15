import { StateCreator } from "zustand";
import { ChatStore, WorkspaceSlice } from "./types";

export const createWorkspaceSlice: StateCreator<
  ChatStore,
  [],
  [],
  WorkspaceSlice
> = (set) => ({
  workspaces: [],
  channels: [],
  activeWorkspaceId: null,
  activeChannelId: null,
  currentUserRole: null, // 🚀 INIT

  setWorkspaces: (workspaces) => set({ workspaces }),
  setChannels: (channels) => set({ channels }),

  setActiveWorkspaceId: (id) =>
    set({
      activeWorkspaceId: id,
      currentUserRole: null, // 🚀 Reset role when switching workspaces
    }),

  setCurrentUserRole: (role) => set({ currentUserRole: role }),

  setActiveChannelId: (id) =>
    set({
      activeChannelId: id,
      selectedUser: null,
      activeRoomId: null,
      messages: [],
      hasMore: false,
      nextCursor: null,
    }),

  updateChannelActivity: (channelId, timestamp) =>
    set((state) => ({
      channels: state.channels.map((c) =>
        c.id === channelId ? { ...c, lastMessageAt: timestamp } : c,
      ),
    })),
});
