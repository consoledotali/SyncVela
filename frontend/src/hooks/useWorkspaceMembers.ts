import { useEffect } from "react";
import { useAuthStore } from "@/src/store/authStore";
import { useChatStore } from "@/src/store/chat";

export const useWorkspaceMembers = () => {
  const { token, user } = useAuthStore();
  const { activeWorkspaceId, setUsers } = useChatStore();

  useEffect(() => {
    if (!activeWorkspaceId || !token) {
      setUsers([]);
      return;
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

          // 🛡️ THE HYDRATION FIX: Store memory ko DM unread counts se bharo
          const counts: Record<string, number> = {};
          filteredMembers.forEach((m: any) => {
            if (m.unreadCount > 0) counts[m.id] = m.unreadCount;
          });

          useChatStore.setState((state) => ({
            unreadCounts: { ...state.unreadCounts, ...counts },
          }));
        }
      } catch (error) {
        console.error("❌ Failed to load workspace members", error);
      }
    };

    fetchMembers();
  }, [activeWorkspaceId, token, user?.id, setUsers]);
};
