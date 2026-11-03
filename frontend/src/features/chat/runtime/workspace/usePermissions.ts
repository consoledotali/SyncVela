import { useChatStore } from "@/src/features/chat/state";

// 🚀 FRONTEND SHADOW MATRIX (Must exactly match Backend rbac.ts)
export type Permission =
  | "VIEW_WORKSPACE"
  | "CREATE_CHANNEL"
  | "DELETE_CHANNEL"
  | "INVITE_USERS"
  | "DELETE_WORKSPACE"
  | "MANAGE_WORKSPACE"
  | "MANAGE_MESSAGES";

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  OWNER: [
    "VIEW_WORKSPACE",
    "CREATE_CHANNEL",
    "DELETE_CHANNEL",
    "INVITE_USERS",
    "DELETE_WORKSPACE",
    "MANAGE_WORKSPACE",
    "MANAGE_MESSAGES",
  ],
  ADMIN: [
    "VIEW_WORKSPACE",
    "CREATE_CHANNEL",
    "INVITE_USERS",
    "MANAGE_MESSAGES",
  ],
  MEMBER: ["VIEW_WORKSPACE"],
  GUEST: ["VIEW_WORKSPACE"],
};

export const usePermissions = () => {
  const { currentUserRole } = useChatStore();

  const hasPermission = (permission: Permission): boolean => {
    // Agar role load nahi hua, default block
    if (!currentUserRole) return false;

    // Check if the current role's array includes the requested permission
    const permissionsForRole = ROLE_PERMISSIONS[currentUserRole] || [];
    return permissionsForRole.includes(permission);
  };

  return { hasPermission, currentUserRole };
};
