import { useEffect } from "react";
import { useAuthStore } from "@/src/store/authStore";
import { useChatStore } from "@/src/features/chat/state";
import { useSocket } from "@/src/providers/SocketProvider";
import { authFetch } from "@/src/lib/authFetch";
import type { SidebarUser, WorkspaceRole } from "@/src/features/chat/state/types";

type WorkspaceMemberResponse = SidebarUser & {
  role: WorkspaceRole;
  unreadCount?: number;
};

export const useWorkspaceMembers = () => {
  const { token, user } = useAuthStore();
  const { activeWorkspaceId, setUsers, setCurrentUserRole } = useChatStore();
  const { socket } = useSocket();

  useEffect(() => {
    if (!activeWorkspaceId || !token || !user) {
      setUsers([]);
      setCurrentUserRole(null);
      return;
    }

    // Immediately clear users from previous workspace
    setUsers([]);

    const fetchMembers = async () => {
      try {
        const response = await authFetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/workspaces/${activeWorkspaceId}/members`,
        );

        if (response.ok) {
          const members = (await response.json()) as WorkspaceMemberResponse[];

          // 🚀 THE RBAC HYDRATION: Extract my own role and save it
          const myRecord = members.find((member) => member.id === user.id);
          if (myRecord && myRecord.role) {
            setCurrentUserRole(myRecord.role);
          }

          // Filter out myself for the sidebar
          const filteredMembers = members.filter((member) => member.id !== user.id);
          setUsers(filteredMembers);

          const counts: Record<string, number> = {};
          filteredMembers.forEach((member) => {
            if (member.unreadCount && member.unreadCount > 0) {
              counts[member.id] = member.unreadCount;
            }
          });

          useChatStore.setState((state) => ({
            unreadCounts: { ...state.unreadCounts, ...counts },
          }));
        }
      } catch (error) {
        console.error("❌ Failed to fetch workspace members:", error);
      }
    };

    fetchMembers();
    socket?.on("connect", fetchMembers);

    return () => {
      if (socket) {
        socket.off("connect", fetchMembers);
      }
    };
  }, [activeWorkspaceId, token, user, setUsers, setCurrentUserRole, socket]);
};

