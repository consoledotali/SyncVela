import { useEffect } from "react";
import { useAuthStore } from "@/src/store/authStore";
import { useChatStore } from "@/src/store/chat";

export const useWorkspaceMembers = () => {
  const { token, user } = useAuthStore();
  const { activeWorkspaceId, setUsers } = useChatStore();

  useEffect(() => {
    if (!activeWorkspaceId || !token) {
      setUsers([]); // Agar workspace nahi hai, toh DMs khali kar do
      return;
    }

    const fetchMembers = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/workspaces/${activeWorkspaceId}/members`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (response.ok) {
          const members = await response.json();
          // 🛡️ Khud ko (current user ko) list se nikal do, taake user khud se DM na kare
          const filteredMembers = members.filter((m: any) => m.id !== user?.id);
          setUsers(filteredMembers);
        }
      } catch (error) {
        console.error("❌ Failed to load workspace members", error);
      }
    };

    fetchMembers();
  }, [activeWorkspaceId, token, user?.id, setUsers]);
};
