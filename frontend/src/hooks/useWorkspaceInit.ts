import { useEffect } from "react";
import { useAuthStore } from "@/src/store/authStore";
import { useChatStore } from "@/src/store/chat";

export const useWorkspaceInit = () => {
  const { isAuthenticated, token } = useAuthStore();
  const { setWorkspaces, setActiveWorkspaceId, workspaces } = useChatStore();

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const fetchWorkspaces = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/workspaces", {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          setWorkspaces(data);

          // Auto-select the first workspace if none is selected
          if (
            data.length > 0 &&
            useChatStore.getState().activeWorkspaceId === null
          ) {
            setActiveWorkspaceId(data[0].id);
          }
        }
      } catch (error) {
        console.error("❌ Failed to load workspaces:", error);
      }
    };

    fetchWorkspaces();
  }, [isAuthenticated, token, setWorkspaces, setActiveWorkspaceId]);
};
