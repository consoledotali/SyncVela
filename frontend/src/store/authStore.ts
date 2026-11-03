import { create } from "zustand";

// 1. Strict Types
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  provider?: "LOCAL" | "GOOGLE";
  hasPassword?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isSessionReady: boolean;

  // Actions
  login: (user: User, token: string) => void;
  restoreSession: (user: User, token: string) => void;
  completeSessionBootstrap: () => void;
  logout: () => void;
}

// Access tokens deliberately remain in memory. The refresh session is held in
// an HttpOnly cookie and the application refreshes after reload rather than
// persisting credentials in browser storage.
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
