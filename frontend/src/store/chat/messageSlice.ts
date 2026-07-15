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

  // 🚀 THE BULLETPROOF FIX: Deduplication on Add
  addMessage: (message) =>
    set((state) => {
      // Check if message already exists via real ID or temp ID
      const isDuplicate = state.messages.some(
        (m) =>
          m.id === message.id ||
          (message.tempId && m.tempId === message.tempId) ||
          (m.tempId && m.tempId === message.id)
      );

      if (isDuplicate) {
        return state; // Reject duplicate silently
      }

      return { messages: [...state.messages, message] };
    }),

  // 🚀 THE BULLETPROOF FIX: Deduplication on Initial Load
  setMessages: (messages) =>
    set(() => {
      // Map takes the last instance of duplicate IDs, ensuring uniqueness
      const uniqueMessages = Array.from(
        new Map(messages.map((m) => [m.id, m])).values()
      );
      return { messages: uniqueMessages, isLoading: false };
    }),

  setPagination: (hasMore, cursor) => set({ hasMore, nextCursor: cursor }),

  // 🚀 THE BULLETPROOF FIX: Deduplication on Pagination (Scroll Up)
  prependMessages: (olderMessages) =>
    set((state) => {
      const existingIds = new Set(state.messages.map((m) => m.id));
      
      // Only keep older messages that DO NOT already exist in our current state
      const newUniqueMessages = olderMessages.filter(
        (m) => !existingIds.has(m.id)
      );

      return { messages: [...newUniqueMessages, ...state.messages] };
    }),

  setIsLoadingMore: (loading) => set({ isLoadingMore: loading }),

  addPendingMessage: (roomId, targetUserId, message) =>
    set((state) => {
      // Prevent duplicate pending entries
      if (
        state.messages.some(
          (m) => m.id === message.id || m.tempId === message.tempId
        )
      ) {
        return state;
      }

      return {
        pendingQueue: [...state.pendingQueue, { roomId, targetUserId, message }],
        messages: [...state.messages, message],
      };
    }),

  removePendingMessage: (messageId) =>
    set((state) => ({
      pendingQueue: state.pendingQueue.filter(
        (p) => p.message.id !== messageId
      ),
    })),

  updateMessageStatus: (messageId, status, tempId) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId || (tempId && msg.tempId === tempId)
          ? { ...msg, status }
          : msg
      ),
    })),

  updateRealMessageId: (tempId: string, realId: string) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.tempId === tempId || msg.id === tempId
          ? { ...msg, id: realId, status: "sent" }
          : msg
      ),
    })),

  deleteMessage: (messageId: string) =>
    set((state) => ({
      messages: state.messages.filter((msg) => msg.id !== messageId),
    })),

  editMessage: (messageId: string, newText: string) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? { ...msg, text: newText } : msg
      ),
    })),
});