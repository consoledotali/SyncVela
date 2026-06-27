import { create } from "zustand";
import { persist } from "zustand/middleware";

// 1. Strict Types
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  // Actions
  login: (user: User, token: string) => void;
  logout: () => void;
}

// 2. The Persistent Store Engine
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      // Login hone par state update aur token save hoga
      login: (user, token) => set({ user, token, isAuthenticated: true }),

      // Logout par sab kuch wipe ho jayega
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: "syncvela-auth", // Is naam se data browser ki localStorage mein save hoga
    },
  ),
);
