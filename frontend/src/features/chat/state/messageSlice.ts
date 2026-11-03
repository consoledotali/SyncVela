import { StateCreator } from "zustand";
import { ChatStore, Message, MessageSlice } from "./types";

export const createMessageSlice: StateCreator<
  ChatStore,
  [],
  [],
  MessageSlice
> = (set) => ({
  messages: [],
  hasMore: false,
  nextCursor: null,
  isLoadingMore: false,
  pendingQueue: [],

  // Reconcile the optimistic row with the authoritative Socket.IO row.
  // This is essential for messages that contain attachments: the optimistic
  // row has blob-preview URLs while the server row has signed object URLs.
  addMessage: (message) =>
    set((state) => {
      const existingIndex = state.messages.findIndex(
        (current) =>
          current.id === message.id ||
          (message.tempId &&
            (current.tempId === message.tempId || current.id === message.tempId)) ||
          (current.tempId && current.tempId === message.id),
      );

      if (existingIndex < 0) {
        return { messages: [...state.messages, message] };
      }

      const existing = state.messages[existingIndex];
      const reconciled = {
        ...existing,
        ...message,
        id: message.id || existing.id,
        tempId: message.tempId || existing.tempId,
        status: message.status || "sent",
        attachments:
          message.attachments && message.attachments.length > 0
            ? message.attachments
            : existing.attachments,
      };
      const messages = [...state.messages];
      messages[existingIndex] = reconciled;

      return {
        messages,
        pendingQueue: state.pendingQueue.filter(
          (pending) =>
            pending.message.id !== existing.id &&
            pending.message.id !== message.id &&
            (!message.tempId || pending.message.tempId !== message.tempId),
        ),
      };
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
  deleteMessage: (messageId: string, parentMessageId?: string | null) =>
    set((state) => {
      // 1. Pehle marnay wale message ko dhoondo taake uska parentMessageId pata chal sake.
      //    Server ab payload mein parentMessageId bhejta hai — is user ne thread open
      //    kiya ho ya na kiya ho, count phir bhi sahi decrement hoga. Local lookup sirf
      //    fallback ke liye hai (purana behaviour).
      const msgToDelete =
        state.threadMessages.find((m) => m.id === messageId) ||
        state.messages.find((m) => m.id === messageId);
      const parentId = parentMessageId ?? msgToDelete?.parentMessageId;

      // 🚀 THE FIX: Kya delete honay wala message wahi Root Parent hai jis par Drawer khula hua hai?
      const isDeletingActiveThread = state.activeThreadParent?.id === messageId;
      const shouldDecrementActiveThread = Boolean(
        state.activeThreadParent &&
          parentId &&
          state.activeThreadParent.id === parentId,
      );
      const updatedActiveThreadParent =
        isDeletingActiveThread
          ? null
          : shouldDecrementActiveThread && state.activeThreadParent
            ? {
                ...state.activeThreadParent,
                _count: {
                  replies: Math.max(
                    0,
                    (state.activeThreadParent._count?.replies || 0) - 1,
                  ),
                },
              }
            : state.activeThreadParent;

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
        activeThreadParent: updatedActiveThreadParent,
      };
    }),

  setThreadReplyCount: (parentMessageId: string, replyCount: number) =>
    set((state) => {
      const normalizedReplyCount = Math.max(0, replyCount);
      const updateParent = (message: Message): Message =>
        message.id === parentMessageId
          ? {
              ...message,
              _count: { replies: normalizedReplyCount },
            }
          : message;

      return {
        messages: state.messages.map(updateParent),
        activeThreadParent:
          state.activeThreadParent?.id === parentMessageId
            ? updateParent(state.activeThreadParent)
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

  updateMessageReactions: (messageId, reactions) =>
    set((state) => {
      const update = (message: Message): Message =>
        message.id === messageId ? { ...message, reactions } : message;
      return {
        messages: state.messages.map(update),
        threadMessages: state.threadMessages.map(update),
        activeThreadParent:
          state.activeThreadParent?.id === messageId
            ? update(state.activeThreadParent)
            : state.activeThreadParent,
      };
    }),
});
