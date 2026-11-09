export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "GUEST";

export type Permission =
  | "VIEW_WORKSPACE"
  | "CREATE_CHANNEL"
  | "DELETE_CHANNEL"
  | "INVITE_USERS"
  | "DELETE_WORKSPACE"
  | "MANAGE_WORKSPACE"
  | "MANAGE_MESSAGES";

export interface Workspace {
  id: string;
  name: string;
  imageUrl?: string | null;
  inviteCode?: string;
}

export interface SidebarUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  isDeleted?: boolean;
  lastMessageAt?: string;
  unreadCount?: number;
}

