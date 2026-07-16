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
          (m.tempId && m.tempId === message.id),
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
        new Map(messages.map((m) => [m.id, m])).values(),
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
        (m) => !existingIds.has(m.id),
      );

      return { messages: [...newUniqueMessages, ...state.messages] };
    }),

  setIsLoadingMore: (loading) => set({ isLoadingMore: loading }),

  addPendingMessage: (roomId, targetUserId, message) =>
    set((state) => {
      // Prevent duplicate pending entries
      if (
        state.messages.some(
          (m) => m.id === message.id || m.tempId === message.tempId,
        )
      ) {
        return state;
      }

      return {
        pendingQueue: [
          ...state.pendingQueue,
          { roomId, targetUserId, message },
        ],
        messages: [...state.messages, message],
      };
    }),

  removePendingMessage: (messageId) =>
    set((state) => ({
      pendingQueue: state.pendingQueue.filter(
        (p) => p.message.id !== messageId,
      ),
    })),

  updateMessageStatus: (messageId, status, tempId) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId || (tempId && msg.tempId === tempId)
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

  // 🚀 THE SMART COLLAPSE ENGINE (Ghost Window + Zero Counter Fix)
  deleteMessage: (messageId: string) =>
    set((state) => {
      // 1. Pehle marnay wale message ko dhoondo taake uska parentMessageId pata chal sake
      const msgToDelete =
        state.threadMessages.find((m) => m.id === messageId) ||
        state.messages.find((m) => m.id === messageId);
      const parentId = msgToDelete?.parentMessageId;

      // 🚀 THE FIX: Kya delete honay wala message wahi Root Parent hai jis par Drawer khula hua hai?
      const isDeletingActiveThread = state.activeThreadParent?.id === messageId;

      return {
        // 2. Message array se udao, aur agar yeh reply tha toh PARENT ka counter -1 karo
        messages: state.messages
          .filter((msg) => msg.id !== messageId)
          .map((msg) => {
            if (parentId && msg.id === parentId) {
              return {
                ...msg,
                _count: {
                  replies: Math.max(0, (msg._count?.replies || 0) - 1),
                },
              };
            }
            return msg;
          }),

        // 3. Thread panel se delete karo. Agar parent ud gaya, toh array instantly flush karo.
        threadMessages: isDeletingActiveThread
          ? []
          : state.threadMessages.filter((msg) => msg.id !== messageId),

        // 4. Thread Drawer Anchor Update
        activeThreadParent: isDeletingActiveThread
          ? null // 🚀 THE FIX: Root message gaya toh Drawer instantly auto-close!
          : state.activeThreadParent &&
              parentId &&
              state.activeThreadParent.id === parentId
            ? ({
                ...state.activeThreadParent,
                _count: {
                  replies: Math.max(
                    0,
                    (state.activeThreadParent._count?.replies || 0) - 1,
                  ),
                },
              } as any)
            : state.activeThreadParent,
      };
    }),

  editMessage: (messageId: string, newText: string) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId ? { ...msg, text: newText } : msg,
      ),
      threadMessages: state.threadMessages.map((msg) =>
        msg.id === messageId ? { ...msg, text: newText } : msg,
      ),
    })),
});
