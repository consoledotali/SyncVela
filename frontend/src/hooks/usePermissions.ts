import { useChatStore } from "@/src/store/chat";

export type Permission =
  | "VIEW_WORKSPACE"
  | "CREATE_CHANNEL"
  | "DELETE_CHANNEL"
  | "INVITE_USERS"
  | "DELETE_WORKSPACE"
  | "MANAGE_WORKSPACE";

// 🚀 STATIC POLICY MATRIX (Mirrors Backend)
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  OWNER: [
    "VIEW_WORKSPACE",
    "CREATE_CHANNEL",
    "DELETE_CHANNEL",
    "INVITE_USERS",
    "DELETE_WORKSPACE",
    "MANAGE_WORKSPACE",
  ],
  ADMIN: ["VIEW_WORKSPACE", "CREATE_CHANNEL", "DELETE_CHANNEL", "INVITE_USERS"],
  MEMBER: ["VIEW_WORKSPACE"],
  GUEST: ["VIEW_WORKSPACE"],
};

export const usePermissions = () => {
  const { currentUserRole } = useChatStore();

  const hasPermission = (permission: Permission): boolean => {
    if (!currentUserRole) return false;
    const allowedPermissions = ROLE_PERMISSIONS[currentUserRole] || [];
    return allowedPermissions.includes(permission);
  };

  return { hasPermission, currentUserRole };
};
