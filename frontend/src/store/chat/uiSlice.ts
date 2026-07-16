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

  activeThreadParent: null,
  threadMessages: [],
  isFetchingThread: false,

  // 🚀 INJECT STATE
  highlightedMessageId: null,

  setSelectedUser: (user) =>
    set((state) => ({
      selectedUser: user,
      activeChannelId: null,
      messages: [],
      activeRoomId: null,
      targetLastReadAt: null,
      hasMore: false,
      nextCursor: null,
      activeThreadParent: null,
      threadMessages: [],
      highlightedMessageId: null,
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

  openThread: (parent) =>
    set({ activeThreadParent: parent, threadMessages: [] }),
  closeThread: () => set({ activeThreadParent: null, threadMessages: [] }),
  setThreadMessages: (replies) => set({ threadMessages: replies }),
  addThreadReply: (reply) =>
    set((state) => ({ threadMessages: [...state.threadMessages, reply] })),
  setIsFetchingThread: (status) => set({ isFetchingThread: status }),

  updateThreadRealMessageId: (tempId, realId) =>
    set((state) => ({
      threadMessages: state.threadMessages.map((msg) =>
        msg.tempId === tempId || msg.id === tempId
          ? { ...msg, id: realId, status: "sent" }
          : msg,
      ),
    })),

  // 🚀 INJECT ACTION
  setHighlightedMessage: (messageId) =>
    set({ highlightedMessageId: messageId }),

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
      activeThreadParent: null,
      threadMessages: [],
      isFetchingThread: false,
      highlightedMessageId: null,
    }),
});
