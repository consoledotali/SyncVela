import { useEffect } from "react";
import { useAuthStore } from "@/src/store/authStore";
import { useChatStore } from "@/src/store/chatStore";

export const useChatInit = () => {
  const { isAuthenticated, user } = useAuthStore();
  const { setUsers } = useChatStore();

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    const fetchInitialData = async () => {
      try {
        const [usersRes, unreadRes] = await Promise.all([
          fetch(`http://localhost:5000/api/users?currentUserId=${user.id}`),
          fetch(
            `http://localhost:5000/api/chat/unread-counts?userId=${user.id}`,
          ),
        ]);

        if (usersRes.ok) setUsers(await usersRes.json());
        if (unreadRes.ok) {
          const counts = await unreadRes.json();
          useChatStore.setState({ unreadCounts: counts });
        }
      } catch (error) {
        console.error("❌ Failed to fetch initial data", error);
      }
    };

    fetchInitialData();
  }, [isAuthenticated, user?.id, setUsers]);
};
