import { useEffect } from "react";
import { useAuthStore } from "@/src/store/authStore";
import { useChatStore } from "@/src/store/chat";

export const useChatInit = () => {
  const { isAuthenticated, token } = useAuthStore();
  const { setUsers } = useChatStore();

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const fetchInitialData = async () => {
      try {
        const headers = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        };

        // 🛡️ THE 404 FIX: Purani 'unread-counts' API hata di gayi hai.
        // Ab poora data explicitly getUsersForSidebar se aayega.
        const usersRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/users`, {
          headers,
        });

        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data);

          // Hydration fallback here as well, just in case this executes first
          const counts: Record<string, number> = {};
          data.forEach((u: any) => {
            if (u.unreadCount > 0) counts[u.id] = u.unreadCount;
          });
          useChatStore.setState((state) => ({
            unreadCounts: { ...state.unreadCounts, ...counts },
          }));
        }
      } catch (error) {
        console.error("❌ Failed to fetch initial data", error);
      }
    };

    fetchInitialData();
  }, [isAuthenticated, token, setUsers]);
};

