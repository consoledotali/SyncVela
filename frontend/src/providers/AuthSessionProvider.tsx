"use client";

import { useEffect } from "react";
import { refreshAccessToken } from "@/src/utils/apiClient";
import { useAuthStore } from "@/src/store/authStore";

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false;

    const restoreFromRefreshCookie = async () => {
      await refreshAccessToken();
      if (!cancelled) useAuthStore.getState().completeSessionBootstrap();
    };

    void restoreFromRefreshCookie();
    return () => {
      cancelled = true;
    };
  }, []);

  return children;
}
