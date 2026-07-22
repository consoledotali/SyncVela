import { useEffect } from "react";
import { useAuthStore } from "@/src/store/authStore";
import { useChatStore } from "@/src/store/chat";
import { authFetch } from "@/src/lib/authFetch";

export const useChatInit = () => {
  const { isAuthenticated, token } = useAuthStore();
  const { setUsers } = useChatStore();

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const fetchInitialData = async () => {
      try {
        const usersRes = await authFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/users`);

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

