import { useAuthStore } from "@/src/store/authStore";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// De-duplicate concurrent refreshes: agar ek waqt mein kai fetches 401 khaayen,
// sab isi single refresh promise ka intezaar karein — warna refresh token race
// ho kar rotate/invalidate ho sakta hai.
let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (!res.ok) return null;
        const data = await res.json();
        const newToken = data.accessToken as string | undefined;
        if (newToken) {
          useAuthStore.setState({ token: newToken });
          return newToken;
        }
        return null;
      } catch {
        return null;
      } finally {
        // Reset so a future 401 can trigger a fresh refresh.
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
};

const withAuthHeader = (
  init: RequestInit | undefined,
  token: string | null,
): RequestInit => {
  const headers = new Headers(init?.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers, credentials: init?.credentials ?? "include" };
};

// Authenticated fetch wrapper: current access token attach karta hai, aur agar
// server 401 (TOKEN_EXPIRED) de to chup-chaap refresh kar ke exactly ek baar
// retry karta hai. Refresh bhi fail ho to user ko logout kar deta hai.
export const authFetch = async (
  input: string,
  init?: RequestInit,
): Promise<Response> => {
  const token = useAuthStore.getState().token;
  let res = await fetch(input, withAuthHeader(init, token));

  if (res.status !== 401) return res;

  // 401 → try a single silent refresh + retry.
  const newToken = await refreshAccessToken();
  if (!newToken) {
    useAuthStore.getState().logout();
    return res;
  }

  res = await fetch(input, withAuthHeader(init, newToken));
  return res;
};
