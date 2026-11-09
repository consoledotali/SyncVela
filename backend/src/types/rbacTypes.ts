import { MemberRole } from "@prisma/client";

export type Permission =
  | "VIEW_WORKSPACE"
  | "CREATE_CHANNEL"
  | "DELETE_CHANNEL"
  | "INVITE_USERS"
  | "DELETE_WORKSPACE"
  | "MANAGE_WORKSPACE"
  | "MANAGE_MESSAGES"
  | "CREATE_MESSAGE";

export interface RBACResult {
  allowed: boolean;
  reason?: string;
  role?: MemberRole;
}

