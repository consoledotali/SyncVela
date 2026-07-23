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
  currentUserRole: null,

  setWorkspaces: (workspaces) => set({ workspaces }),
  setChannels: (channels) => set({ channels }),

  setActiveWorkspaceId: (id) =>
    set((state) =>
      // Re-selecting the SAME workspace must not wipe role/thread state.
      // useWorkspaceInit re-sets the active id after its fetch resolves; if
      // that reset the role it would race useWorkspaceMembers and leave
      // currentUserRole null (owner sees no actions). Only reset on a real switch.
      state.activeWorkspaceId === id
        ? { activeWorkspaceId: id }
        : {
            activeWorkspaceId: id,
            currentUserRole: null,
            activeThreadParent: null, // 🚀 THE STICKY DRAWER FIX (Workspace Switch)
            threadMessages: [],
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
