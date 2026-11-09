import { useEffect } from "react";
import { useAuthStore } from "@/src/store/authStore";
import { useChatStore } from "@/src/store/chatStore";
import { useSocket } from "@/src/providers/SocketProvider";
import { authFetch } from "@/src/utils/apiUtils";
import type { SidebarUser, WorkspaceRole } from "@/src/types/workspaceTypes";

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

    setUsers([]);

    const fetchMembers = async () => {
      try {
        const response = await authFetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/workspaces/${activeWorkspaceId}/members`,
        );

        if (response.ok) {
          const members = (await response.json()) as WorkspaceMemberResponse[];

          const myRecord = members.find((member) => member.id === user.id);
          if (myRecord && myRecord.role) {
            setCurrentUserRole(myRecord.role);
          }

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
        console.error("Failed to load workspace members", error);
      }
    };

    fetchMembers();

    if (socket) {
      socket.emit("join_workspace", activeWorkspaceId);
    }
  }, [activeWorkspaceId, token, user, setUsers, setCurrentUserRole, socket]);
};

