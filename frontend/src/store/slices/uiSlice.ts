import { StateCreator } from "zustand";
import { ChatStore, ChatUISlice } from "@/src/types/chat";

export const createChatUISlice: StateCreator<ChatStore, [], [], ChatUISlice> = (
  set,
) => ({
  selectedUser: null,
  activeRoomId: null,
  isLoading: false,
  typingParticipants: {},
  targetLastReadAt: null,

  activeThreadParent: null,
  threadMessages: [],
  isFetchingThread: false,

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
  setTypingParticipant: (conversationKey, userId, expiresAt) =>
    set((state) => ({
      typingParticipants: {
        ...state.typingParticipants,
        [conversationKey]: {
          ...state.typingParticipants[conversationKey],
          [userId]: expiresAt,
        },
      },
    })),
  removeTypingParticipant: (conversationKey, userId) =>
    set((state) => {
      const participants = { ...state.typingParticipants[conversationKey] };
      delete participants[userId];
      return {
        typingParticipants: {
          ...state.typingParticipants,
          [conversationKey]: participants,
        },
      };
    }),
  clearTypingConversation: (conversationKey) =>
    set((state) => {
      const typingParticipants = { ...state.typingParticipants };
      delete typingParticipants[conversationKey];
      return { typingParticipants };
    }),
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
      typingParticipants: {},
      targetLastReadAt: null,
      activeThreadParent: null,
      threadMessages: [],
      isFetchingThread: false,
      highlightedMessageId: null,
    }),
});

