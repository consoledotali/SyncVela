import { useEffect } from "react";
import { useAuthStore } from "@/src/store/authStore";
import { useChatStore } from "@/src/store/chat";
import { useSocket } from "@/src/providers/SocketProvider"; // 🟢 IMPORT SOCKET

export const useWorkspaceMembers = () => {
  const { token, user } = useAuthStore();
  const { activeWorkspaceId, setUsers } = useChatStore();
  const { socket } = useSocket(); // 🟢 GET SOCKET INSTANCE

  useEffect(() => {
    if (!activeWorkspaceId || !token) {
      setUsers([]);
      return;
    }

    // 🚀 THE FIX: Dynamically join the workspace socket room!
    if (socket) {
      socket.emit("join_workspace", activeWorkspaceId);
    }

    const fetchMembers = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/workspaces/${activeWorkspaceId}/members`,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (response.ok) {
          const members = await response.json();
          const filteredMembers = members.filter((m: any) => m.id !== user?.id);
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
  }, [activeWorkspaceId, token, user, setUsers, socket]); // Dependency array updated
};