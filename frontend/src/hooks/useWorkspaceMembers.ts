import { useEffect } from "react";
import { useAuthStore } from "@/src/store/authStore";
import { useChatStore } from "@/src/store/chat";
import { useSocket } from "@/src/providers/SocketProvider";
import { authFetch } from "@/src/lib/authFetch";

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

    if (socket) {
      socket.emit("join_workspace", activeWorkspaceId);
    }

    const fetchMembers = async () => {
      try {
        const response = await authFetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/workspaces/${activeWorkspaceId}/members`,
        );

        if (response.ok) {
          const members = await response.json();

          // 🚀 THE RBAC HYDRATION: Extract my own role and save it
          const myRecord = members.find((m: any) => m.id === user.id);
          if (myRecord && myRecord.role) {
            setCurrentUserRole(myRecord.role);
          }

          // Filter out myself for the sidebar
          const filteredMembers = members.filter((m: any) => m.id !== user.id);
          setUsers(filteredMembers);

          const counts: Record<string, number> = {};
          filteredMembers.forEach((m: any) => {
            if (m.unreadCount > 0) counts[m.id] = m.unreadCount;
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
  }, [activeWorkspaceId, token, user, setUsers, setCurrentUserRole, socket]);
};

