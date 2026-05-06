import { create, StateCreator } from "zustand";
import { persist } from "zustand/middleware";

// ==========================================
// 1. DOMAIN TYPES
// ==========================================
export type MessageStatus = "pending" | "sent" | "delivered" | "read";

export interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: string;
  status?: MessageStatus;
  tempId?: string;
  attachmentUrl?: string | null;
}

export interface SidebarUser {
  id: string;
  name: string;
  email: string;
}

export interface PendingMessage {
  roomId: string;
  targetUserId: string;
  message: Message;
}

// ==========================================
// 2. SLICE INTERFACES
// ==========================================
interface ChatUISlice {
  selectedUser: SidebarUser | null;
  activeRoomId: string | null;
  isLoading: boolean;
  typingUsers: string[];
  targetLastReadAt: string | null;

  setSelectedUser: (user: SidebarUser | null) => void;
  setActiveRoomId: (id: string | null) => void;
  setLoading: (status: boolean) => void;
  addTypingUser: (userId: string) => void;
  removeTypingUser: (userId: string) => void;
  setTargetLastReadAt: (time: string | null) => void;
  resetChat: () => void;
}

interface UserSlice {
  users: SidebarUser[];
  onlineUsers: string[];
  unreadCounts: Record<string, number>;

  setUsers: (users: SidebarUser[]) => void;
  setOnlineUsers: (userIds: string[]) => void;
  incrementUnread: (userId: string) => void;
  clearUnread: (userId: string) => void;
  moveUserToTop: (userId: string) => void;
}

interface MessageSlice {
  messages: Message[];
  hasMore: boolean;
  nextCursor: string | null;
  isLoadingMore: boolean;
  pendingQueue: PendingMessage[];

  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  setPagination: (hasMore: boolean, cursor: string | null) => void;
  prependMessages: (olderMessages: Message[]) => void;
  setIsLoadingMore: (loading: boolean) => void;
  
  // Queue & Status Actions
  addPendingMessage: (roomId: string, targetUserId: string, message: Message) => void;
  removePendingMessage: (messageId: string) => void;
  updateMessageStatus: (messageId: string, status: MessageStatus, tempId?: string) => void;
  updateRealMessageId: (tempId: string, realId: string) => void;
}

// THE UNIFIED STORE TYPE
type ChatStore = ChatUISlice & UserSlice & MessageSlice;

// ==========================================
// 3. SLICE IMPLEMENTATIONS
// ==========================================

const createChatUISlice: StateCreator<ChatStore, [], [], ChatUISlice> = (set) => ({
  selectedUser: null,
  activeRoomId: null,
  isLoading: false,
  typingUsers: [],
  targetLastReadAt: null,

  setSelectedUser: (user) =>
    set((state) => ({
      selectedUser: user,
      messages: [],
      activeRoomId: null,
      targetLastReadAt: null,
      hasMore: false,
      nextCursor: null,
      unreadCounts: { ...state.unreadCounts, [user?.id || ""]: 0 },
    })),
  setActiveRoomId: (id) => set({ activeRoomId: id }),
  setLoading: (status) => set({ isLoading: status }),
  addTypingUser: (userId) =>
    set((state) => ({
      typingUsers: state.typingUsers.includes(userId) ? state.typingUsers : [...state.typingUsers, userId],
    })),
  removeTypingUser: (userId) =>
    set((state) => ({
      typingUsers: state.typingUsers.filter((id) => id !== userId),
    })),
  setTargetLastReadAt: (time) => set({ targetLastReadAt: time }),
  resetChat: () =>
    set({
      users: [],
      selectedUser: null,
      messages: [],
      onlineUsers: [],
      unreadCounts: {},
      activeRoomId: null,
      hasMore: false,
      nextCursor: null,
      isLoadingMore: false,
      targetLastReadAt: null,
      // Note: pendingQueue is deliberately not reset here to preserve offline state
    }),
});

const createUserSlice: StateCreator<ChatStore, [], [], UserSlice> = (set) => ({
  users: [],
  onlineUsers: [],
  unreadCounts: {},

  setUsers: (users) => set({ users }),
  setOnlineUsers: (userIds) => set({ onlineUsers: userIds }),
  incrementUnread: (userId) =>
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [userId]: (state.unreadCounts[userId] || 0) + 1 },
    })),
  clearUnread: (userId) =>
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [userId]: 0 },
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

const createMessageSlice: StateCreator<ChatStore, [], [], MessageSlice> = (set) => ({
  messages: [],
  hasMore: false,
  nextCursor: null,
  isLoadingMore: false,
  pendingQueue: [],

  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
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
      pendingQueue: state.pendingQueue.filter((p) => p.message.id !== messageId),
    })),
  updateMessageStatus: (messageId, status, tempId) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === messageId || (tempId && msg.id === tempId) ? { ...msg, status } : msg
      ),
    })),
  updateRealMessageId: (tempId, realId) =>
    set((state) => ({
      messages: state.messages.map((msg) => (msg.id === tempId ? { ...msg, id: realId } : msg)),
    })),
});

// ==========================================
// 4. MAIN STORE EXPORT (The Orchestrator)
// ==========================================
export const useChatStore = create<ChatStore>()(
  persist(
    (...a) => ({
      ...createChatUISlice(...a),
      ...createUserSlice(...a),
      ...createMessageSlice(...a),
    }),
    {
      name: "syncvela-chat-storage",
      // Strictly persist ONLY the pending queue to prevent UI cache ghosts
      partialize: (state) => ({ pendingQueue: state.pendingQueue }),
    }
  )
);