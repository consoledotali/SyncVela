import prisma from "../config/db";
import { MemberRole } from "@prisma/client";

// 1. Define all granular operations available in the system
export type Permission =
  | "VIEW_WORKSPACE"
  | "CREATE_CHANNEL"
  | "DELETE_CHANNEL"
  | "INVITE_USERS"
  | "DELETE_WORKSPACE"
  | "MANAGE_WORKSPACE";

// 2. 🚀 THE STATIC POLICY MATRIX (Zero DB Overhead)
const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  OWNER: [
    "VIEW_WORKSPACE",
    "CREATE_CHANNEL",
    "DELETE_CHANNEL",
    "INVITE_USERS",
    "DELETE_WORKSPACE",
    "MANAGE_WORKSPACE",
  ],
  ADMIN: [
    "VIEW_WORKSPACE",
    "CREATE_CHANNEL",
    "DELETE_CHANNEL",
    "INVITE_USERS",
  ],
  MEMBER: ["VIEW_WORKSPACE"], // Members strictly view-only for architectural actions
  GUEST: ["VIEW_WORKSPACE"],
};

interface RBACResult {
  allowed: boolean;
  reason?: string;
  role?: MemberRole;
}

// 3. The Centralized Authorizer
export const authorizeRBAC = async (
  userId: string,
  workspaceId: string,
  requiredPermission: Permission
): Promise<RBACResult> => {
  const member = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { role: true },
  });

  if (!member) {
    return {
      allowed: false,
      reason: "Access Denied: You are not a member of this workspace.",
    };
  }

  const hasAccess = ROLE_PERMISSIONS[member.role]?.includes(requiredPermission);

  if (!hasAccess) {
    return {
      allowed: false,
      reason: `RBAC Authorization Failed: Your role (${member.role}) does not have the '${requiredPermission}' privilege.`,
    };
  }

  return { allowed: true, role: member.role };
};