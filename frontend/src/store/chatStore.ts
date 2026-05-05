import { create } from "zustand";
import { persist } from "zustand/middleware";

// NAYA: 4 States ka Type
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

// NAYA: Pending queue ke liye strict type
export interface PendingMessage {
  roomId: string;
  targetUserId: string;
  message: Message;
}

interface ChatState {
  messages: Message[];
  users: SidebarUser[];
  selectedUser: SidebarUser | null;
  activeRoomId: string | null;
  isLoading: boolean;
  onlineUsers: string[];
  unreadCounts: Record<string, number>;
  targetLastReadAt: string | null;
  hasMore: boolean;
  nextCursor: string | null;
  isLoadingMore: boolean;
  typingUsers: string[]; // Boolean ki jagah Array of User IDs

  // NAYA: The Offline Queue
  pendingQueue: PendingMessage[];

  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  setUsers: (users: SidebarUser[]) => void;
  setSelectedUser: (user: SidebarUser | null) => void;
  setActiveRoomId: (id: string | null) => void;
  setLoading: (status: boolean) => void;

  addTypingUser: (userId: string) => void;
  removeTypingUser: (userId: string) => void;

  setOnlineUsers: (userIds: string[]) => void;
  incrementUnread: (userId: string) => void;
  clearUnread: (userId: string) => void;
  setTargetLastReadAt: (time: string | null) => void;
  setPagination: (hasMore: boolean, cursor: string | null) => void;
  prependMessages: (olderMessages: Message[]) => void;
  setIsLoadingMore: (loading: boolean) => void;
  moveUserToTop: (userId: string) => void;
  resetChat: () => void;

  // NAYE ACTIONS: Queue aur Status Management
  addPendingMessage: (
    roomId: string,
    targetUserId: string,
    message: Message,
  ) => void;
  removePendingMessage: (messageId: string) => void;
  updateMessageStatus: (
    messageId: string,
    status: MessageStatus,
    tempId?: string,
  ) => void;

  updateRealMessageId: (tempId: string, realId: string) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      // --- DEFAULT STATES ---
      messages: [],
      users: [],
      selectedUser: null,
      activeRoomId: null,
      isLoading: false,
      onlineUsers: [],
      unreadCounts: {},
      targetLastReadAt: null,
      hasMore: false,
      nextCursor: null,
      isLoadingMore: false,
      pendingQueue: [], // NAYA
      typingUsers: [],

      // --- ACTIONS ---
      addMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),

      setMessages: (messages) => set({ messages, isLoading: false }),

      setUsers: (users) => set({ users }),

      setActiveRoomId: (id) => set({ activeRoomId: id }),

      setLoading: (status) => set({ isLoading: status }),

      addTypingUser: (userId) =>
        set((state) => ({
          // Agar array mein pehle se nahi hai toh add karo
          typingUsers: state.typingUsers.includes(userId)
            ? state.typingUsers
            : [...state.typingUsers, userId],
        })),

      removeTypingUser: (userId) =>
        set((state) => ({
          // Filter karke nikal do
          typingUsers: state.typingUsers.filter((id) => id !== userId),
        })),

      setOnlineUsers: (userIds) => set({ onlineUsers: userIds }),

      incrementUnread: (userId) =>
        set((state) => ({
          unreadCounts: {
            ...state.unreadCounts,
            [userId]: (state.unreadCounts[userId] || 0) + 1,
          },
        })),

      clearUnread: (userId) =>
        set((state) => ({
          unreadCounts: {
            ...state.unreadCounts,
            [userId]: 0,
          },
        })),

      setTargetLastReadAt: (time) => set({ targetLastReadAt: time }),

      setPagination: (hasMore, cursor) => set({ hasMore, nextCursor: cursor }),

      prependMessages: (olderMessages) =>
        set((state) => ({
          messages: [...olderMessages, ...state.messages],
        })),

      setIsLoadingMore: (loading) => set({ isLoadingMore: loading }),

      moveUserToTop: (userId) =>
        set((state) => {
          const userIndex = state.users.findIndex((u) => u.id === userId);

          // Agar user nahi mila, ya pehle se hi top par hai, toh ignore karo
          if (userIndex <= 0) return state;

          // STRICT IMMUTABILITY: Naya array banao taake React component re-render ho
          const newUsersList = [...state.users];
          const extractedUser = newUsersList[userIndex];

          // Purani jagah se nikalo
          newUsersList.splice(userIndex, 1);
          // Top par naya reference daalo
          newUsersList.unshift({ ...extractedUser });

          return { users: newUsersList };
        }),

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
          // pendingQueue ko reset nahi karna
        }),

      // --- NAYE QUEUE ACTIONS ---
      addPendingMessage: (roomId, targetUserId, message) =>
        set((state) => ({
          pendingQueue: [
            ...state.pendingQueue,
            { roomId, targetUserId, message },
          ],
          messages: [...state.messages, message],
        })),

      removePendingMessage: (messageId) =>
        set((state) => ({
          pendingQueue: state.pendingQueue.filter(
            (p) => p.message.id !== messageId,
          ),
        })),

      updateMessageStatus: (messageId, status, tempId) =>
        set((state) => {
          // THE NUCLEAR SWEEP: Ek hi dafa array map karo aur dono IDs (real ya fake) ko target karo
          const updatedMessages = state.messages.map((msg) => {
            if (msg.id === messageId || (tempId && msg.id === tempId)) {
              return { ...msg, status };
            }
            return msg;
          });

          return { messages: updatedMessages };
        }),

      updateRealMessageId: (tempId, realId) =>
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg.id === tempId ? { ...msg, id: realId } : msg,
          ),
        })),
    }),
    {
      name: "syncvela-chat-storage",
      partialize: (state) => ({
        pendingQueue: state.pendingQueue,
      }),
    },
  ),
);
