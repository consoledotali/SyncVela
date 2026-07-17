import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/src/store/chat";
import { useAuthStore } from "@/src/store/authStore";

export const useWorkspaceInit = () => {
  const { token, isAuthenticated } = useAuthStore();
  const { setWorkspaces, setActiveWorkspaceId, activeWorkspaceId } =
    useChatStore();
  const router = useRouter();

  // ==========================================
  // 🚀 1. THE FETCH & HYDRATION ENGINE
  // ==========================================
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const fetchWorkspaces = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/workspaces`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();

          // 🚀 THE ONBOARDING REDIRECT (Strict Lock)
          // Agar user ke paas 0 workspaces hain, toh seedha form par bhejo
          if (data.length === 0) {
            router.replace("/create-workspace");
            return; // Execution yahin rok do taake aage ka kachra na chale
          }

          setWorkspaces(data);

          if (data.length > 0) {
            // 🛡️ THE BULLETPROOF MEMORY FIX: LocalStorage se aakhri workspace dhoondo
            const savedWorkspaceId = localStorage.getItem(
              "lastActiveWorkspaceId",
            );

            // 🛡️ SECURITY CHECK: Kya wo workspace abhi bhi data mein exist karti hai?
            // (Kahin user us se remove toh nahi ho gaya?)
            const isValidWorkspace = data.some(
              (w: any) => w.id === savedWorkspaceId,
            );

            if (isValidWorkspace && savedWorkspaceId) {
              // Purani workspace ko zinda karo
              setActiveWorkspaceId(savedWorkspaceId);
            } else {
              // Agar user pehli dafa aaya hai ya purani workspace delete ho chuki hai, toh fallback to index 0
              setActiveWorkspaceId(data[0].id);
              localStorage.setItem("lastActiveWorkspaceId", data[0].id);
            }
          }
        }
      } catch (error) {
        console.error("❌ Failed to fetch workspaces:", error);
      }
    };

    fetchWorkspaces();
  }, [token, isAuthenticated, setWorkspaces, setActiveWorkspaceId, router]);

  // ==========================================
  // 🚀 2. THE INTENT TRACKER (Saves instantly)
  // ==========================================
  useEffect(() => {
    // Jab bhi user manually dropdown se workspace switch karega, yeh usay hamesha ke liye save kar lega
    if (activeWorkspaceId) {
      localStorage.setItem("lastActiveWorkspaceId", activeWorkspaceId);
    }
  }, [activeWorkspaceId]);
};

