import { useEffect } from "react";
import { useAuthStore } from "@/src/store/authStore";
import { useChatStore } from "@/src/store/chat";

export const useChatInit = () => {
  const { isAuthenticated, token } = useAuthStore(); // 🛡️ user.id ki jagah token nikalo
  const { setUsers } = useChatStore();

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const fetchInitialData = async () => {
      try {
        // 🛡️ SECURITY FIX: Do not pass ID in URL. Pass token in Headers.
        const headers = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        };

        const [usersRes, unreadRes] = await Promise.all([
          fetch(`http://localhost:5000/api/users`, { headers }), // URL cleaned
          fetch(`http://localhost:5000/api/chat/unread-counts`, { headers }), // URL cleaned
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
  }, [isAuthenticated, token, setUsers]);
};
