import { StateCreator } from "zustand";
import { ChatStore, WorkspaceSlice } from "@/src/types/chat";

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
  currentUserRole: null,

  setWorkspaces: (workspaces) => set({ workspaces }),
  setChannels: (channels) => set({ channels }),

  setActiveWorkspaceId: (id) =>
    set((state) =>
      state.activeWorkspaceId === id
        ? { activeWorkspaceId: id }
        : {
            activeWorkspaceId: id,
            currentUserRole: null,
            activeThreadParent: null,
            threadMessages: [],
            selectedUser: null,
            activeRoomId: null,
            activeChannelId: null,
            messages: [],
          },
    ),

  setCurrentUserRole: (role) => set({ currentUserRole: role }),

  setActiveChannelId: (id) =>
    set({
      activeChannelId: id,
      selectedUser: null,
      activeRoomId: null,
      messages: [],
      hasMore: false,
      nextCursor: null,
      activeThreadParent: null,
      threadMessages: [],
    }),

  updateChannelActivity: (channelId, timestamp) =>
    set((state) => ({
      channels: state.channels.map((c) =>
        c.id === channelId ? { ...c, lastMessageAt: timestamp } : c,
      ),
    })),
});

