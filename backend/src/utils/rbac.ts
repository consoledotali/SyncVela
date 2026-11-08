import { MemberRole } from "../generated/prisma/client";
import prisma from "../config/db";

export type Permission =
  | "VIEW_WORKSPACE"
  | "CREATE_CHANNEL"
  | "DELETE_CHANNEL"
  | "INVITE_USERS"
  | "DELETE_WORKSPACE"
  | "MANAGE_WORKSPACE"
  | "MANAGE_MESSAGES"
  | "CREATE_MESSAGE";

const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  OWNER: [
    "VIEW_WORKSPACE",
    "CREATE_CHANNEL",
    "DELETE_CHANNEL",
    "INVITE_USERS",
    "DELETE_WORKSPACE",
    "MANAGE_WORKSPACE",
    "MANAGE_MESSAGES",
    "CREATE_MESSAGE",
  ],
  ADMIN: [
    "VIEW_WORKSPACE",
    "CREATE_CHANNEL",
    "INVITE_USERS",
    "MANAGE_MESSAGES",
    "CREATE_MESSAGE",
  ],
  MEMBER: [
    "VIEW_WORKSPACE",
    "CREATE_CHANNEL",
    "CREATE_MESSAGE",
  ],
  GUEST: ["VIEW_WORKSPACE"],
};

interface RBACResult {
  allowed: boolean;
  reason?: string;
  role?: MemberRole;
}

export const authorizeRBAC = async (
  userId: string,
  workspaceId: string,
  requiredPermission: Permission,
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
