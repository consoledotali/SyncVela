import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/src/store/chatStore";
import { useAuthStore } from "@/src/store/authStore";
import { authFetch } from "@/src/utils/apiUtils";
import type { Workspace } from "@/src/types/workspaceTypes";

export const useWorkspaceInit = () => {
  const { token, isAuthenticated } = useAuthStore();
  const { setWorkspaces, setActiveWorkspaceId, activeWorkspaceId } =
    useChatStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const fetchWorkspaces = async () => {
      try {
        const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/workspaces`);

        if (response.ok) {
          const data = (await response.json()) as Workspace[];

          if (data.length === 0) {
            router.replace("/create-workspace");
            return;
          }

          setWorkspaces(data);

          if (data.length > 0) {
            const savedWorkspaceId = localStorage.getItem(
              "lastActiveWorkspaceId",
            );

            const isValidWorkspace = data.some(
              (workspace) => workspace.id === savedWorkspaceId,
            );

            if (isValidWorkspace && savedWorkspaceId) {
              setActiveWorkspaceId(savedWorkspaceId);
            } else {
              setActiveWorkspaceId(data[0].id);
              localStorage.setItem("lastActiveWorkspaceId", data[0].id);
            }
          }
        }
      } catch (error) {
        console.error("Failed to initialize workspace", error);
      }
    };

    fetchWorkspaces();
  }, [isAuthenticated, token, setActiveWorkspaceId, setWorkspaces, router]);

  useEffect(() => {
    if (activeWorkspaceId) {
      localStorage.setItem("lastActiveWorkspaceId", activeWorkspaceId);
    }
  }, [activeWorkspaceId]);
};

