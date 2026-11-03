import axios, { AxiosRequestConfig } from "axios";
import { useAuthStore, type User } from "@/src/store/authStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// De-duplicate concurrent refreshes: agar ek waqt mein kai requests 401 khaayen,
// sab isi single refresh promise ka intezaar karein — warna refresh token race
// ho kar rotate/invalidate ho sakta hai.
type RefreshSession = { accessToken: string; user: User };
let refreshPromise: Promise<RefreshSession | null> | null = null;

const isAccessTokenExpiringSoon = (token: string) => {
  try {
    const payload = token.split(".")[1];
    if (!payload) return true;
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      Math.ceil(normalizedPayload.length / 4) * 4,
      "=",
    );
    const claims = JSON.parse(atob(paddedPayload)) as { exp?: number };
    return !claims.exp || claims.exp * 1000 <= Date.now() + 30_000;
  } catch {
    return true;
  }
};

// Wrap an axios result in a Web API Response so every existing caller
// (res.ok, res.status, res.json()) keeps working without any change.
const toFetchResponse = (status: number, data: unknown): Response =>
  new Response(data === undefined ? null : JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const refreshAccessToken = async (): Promise<RefreshSession | null> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await axios.post(
          `${API_URL}/api/auth/refresh`,
          {},
          { withCredentials: true, validateStatus: () => true },
        );
        if (res.status !== 200) return null;
        const accessToken = res.data?.accessToken as string | undefined;
        const user = res.data?.user as User | undefined;
        if (accessToken && user) {
          useAuthStore.getState().restoreSession(user, accessToken);
          return { accessToken, user };
        }
        return null;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
};

// Convert a fetch-style RequestInit into an axios config. Keeps the authFetch
// call sites identical to the old fetch-based API.
const toAxiosConfig = (
  url: string,
  init: RequestInit | undefined,
  token: string | null,
): AxiosRequestConfig => {
  const headers: Record<string, string> = {};
  if (init?.headers) {
    new Headers(init.headers as HeadersInit).forEach((v, k) => {
      headers[k] = v;
    });
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let data: unknown = undefined;
  if (init?.body) {
    try {
      data = JSON.parse(init.body as string);
    } catch {
      data = init.body;
    }
  }

  return {
    url,
    method: (init?.method || "GET") as AxiosRequestConfig["method"],
    headers,
    data,
    withCredentials: true,
    validateStatus: () => true, // never throw on HTTP status — mirrors fetch
  };
};

// Authenticated request wrapper: current access token attach karta hai, aur agar
// server 401 (TOKEN_EXPIRED) de to chup-chaap refresh kar ke exactly ek baar
// retry karta hai. Refresh bhi fail ho to user ko logout kar deta hai.
export const authFetch = async (
  input: string,
  init?: RequestInit,
): Promise<Response> => {
  let token = useAuthStore.getState().token;

  // Refresh before a token is missing or about to expire. This prevents an
  // expected 401 from ever reaching the network panel during normal use.
  if (!token || isAccessTokenExpiringSoon(token)) {
    const refreshedSession = await refreshAccessToken();
    if (!refreshedSession) {
      if (!token) useAuthStore.getState().logout();
      return toFetchResponse(401, { error: "Your session has expired." });
    }
    token = refreshedSession.accessToken;
  }

  let res = await axios(toAxiosConfig(input, init, token));

  if (res.status !== 401) return toFetchResponse(res.status, res.data);

  // 401 → try a single silent refresh + retry.
  const refreshedSession = await refreshAccessToken();
  if (!refreshedSession) {
    useAuthStore.getState().logout();
    return toFetchResponse(res.status, res.data);
  }

  res = await axios(toAxiosConfig(input, init, refreshedSession.accessToken));
  return toFetchResponse(res.status, res.data);
};
