import { create } from "zustand";
import type { User } from "@/src/types/authTypes";

export type { User };

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isSessionReady: boolean;

  login: (user: User, token: string) => void;
  restoreSession: (user: User, token: string) => void;
  completeSessionBootstrap: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isSessionReady: false,
  login: (user, token) => set({ user, token, isAuthenticated: true, isSessionReady: true }),
  restoreSession: (user, token) =>
    set({ user, token, isAuthenticated: true, isSessionReady: true }),
  completeSessionBootstrap: () => set({ isSessionReady: true }),
  logout: () =>
    set({ user: null, token: null, isAuthenticated: false, isSessionReady: true }),
}));
