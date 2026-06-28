import { StateCreator } from "zustand";
import { ChatStore, MessageSlice } from "./types";

export const createMessageSlice: StateCreator<
  ChatStore,
  [],
  [],
  MessageSlice
> = (set, get) => ({
  messages: [],
  hasMore: false,
  nextCursor: null,
  isLoadingMore: false,
  pendingQueue: [],

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setMessages: (messages) => set({ messages, isLoading: false }),

  setPagination: (hasMore, cursor) => set({ hasMore, nextCursor: cursor }),

  prependMessages: (olderMessages) =>
    set((state) => ({ messages: [...olderMessages, ...state.messages] })),

  setIsLoadingMore: (loading) => set({ isLoadingMore: loading }),

  addPendingMessage: (roomId, targetUserId, message) =>
    set((state) => ({
      pendingQueue: [...state.pendingQueue, { roomId, targetUserId, message }],
      messages: [...state.messages, message],
    })),

  removePendingMessage: (messageId) =>
    set((state) => ({
      pendingQueue: state.pendingQueue.filter(
        (p) => p.message.id !== messageId,
      ),
    })),

  updateMessageStatus: (messageId, status, tempId) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId || (tempId && msg.id === tempId)
          ? { ...msg, status }
          : msg,
      ),
    })),

  updateRealMessageId: (tempId: string, realId: string) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.tempId === tempId || msg.id === tempId
          ? { ...msg, id: realId, status: "sent" }
          : msg,
      ),
    })),

  deleteMessage: (messageId: string) =>
    set((state) => ({
      messages: state.messages.filter((msg) => msg.id !== messageId),
    })),
});
