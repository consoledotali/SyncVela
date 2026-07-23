export type MessageStatus = "pending" | "sent" | "delivered" | "read";

export interface Attachment {
  id?: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface Workspace {
  id: string;
  name: string;
  imageUrl?: string | null;
  inviteCode?: string;
}

export interface Channel {
  id: string;
  name: string;
  type: "PUBLIC" | "PRIVATE";
  workspaceId: string;
  lastMessageAt?: string;
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: string;
  status?: MessageStatus;
  tempId?: string;
  attachmentUrl?: string | null;
  attachments?: Attachment[];
  sender?: { id: string; name: string; avatarUrl?: string | null };
  parentMessageId?: string | null;
  _count?: { replies: number };
}

export interface SidebarUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  lastMessageAt?: string;
}

export interface PendingMessage {
  roomId: string;
  targetUserId?: string;
  message: Message;
}

export interface WorkspaceSlice {
  workspaces: Workspace[];
  channels: Channel[];
  activeWorkspaceId: string | null;
  activeChannelId: string | null;
  currentUserRole: "OWNER" | "ADMIN" | "MEMBER" | "GUEST" | null;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setChannels: (channels: Channel[]) => void;
  setActiveWorkspaceId: (id: string | null) => void;
  setActiveChannelId: (id: string | null) => void;
  setCurrentUserRole: (role: any) => void;
  updateChannelActivity: (channelId: string, timestamp: string) => void;
}

export interface ChatUISlice {
  selectedUser: SidebarUser | null;
  activeRoomId: string | null;
  isLoading: boolean;
  typingUsers: string[];
  targetLastReadAt: string | null;

  activeThreadParent: Message | null;
  threadMessages: Message[];
  isFetchingThread: boolean;

  // 🚀 THE FLASH REGISTRY INJECTION
  highlightedMessageId: string | null;

  setSelectedUser: (user: SidebarUser | null) => void;
  setActiveRoomId: (id: string | null) => void;
  setLoading: (status: boolean) => void;
  addTypingUser: (userId: string) => void;
  removeTypingUser: (userId: string) => void;
  setTargetLastReadAt: (time: string | null) => void;
  resetChat: () => void;

  openThread: (parent: Message) => void;
  closeThread: () => void;
  setThreadMessages: (replies: Message[]) => void;
  addThreadReply: (reply: Message) => void;
  setIsFetchingThread: (status: boolean) => void;
  updateThreadRealMessageId: (tempId: string, realId: string) => void;

  // 🚀 ACTION TRIGGER TYPE INJECTION
  setHighlightedMessage: (messageId: string | null) => void;
}

export interface UserSlice {
  users: SidebarUser[];
  onlineUsers: string[];
  unreadCounts: Record<string, number>;
  channelUnreadCounts: Record<string, number>;
  setUsers: (users: SidebarUser[]) => void;
  setOnlineUsers: (userIds: string[]) => void;
  incrementUnread: (userId: string) => void;
  clearUnread: (userId: string) => void;
  incrementChannelUnread: (channelId: string) => void;
  clearChannelUnread: (channelId: string) => void;
  moveUserToTop: (userId: string) => void;
  decrementUnread: (userId: string) => void;
  decrementChannelUnread: (channelId: string) => void;
  updateUserActivity: (userId: string, timestamp: string) => void;
}

export interface MessageSlice {
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
  deleteMessage: (messageId: string, parentMessageId?: string | null) => void;
  editMessage: (messageId: string, newText: string) => void;
}

export type ChatStore = WorkspaceSlice & ChatUISlice & UserSlice & MessageSlice;
