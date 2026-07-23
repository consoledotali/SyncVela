import axios, { AxiosRequestConfig } from "axios";
import { useAuthStore } from "@/src/store/authStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// De-duplicate concurrent refreshes: agar ek waqt mein kai requests 401 khaayen,
// sab isi single refresh promise ka intezaar karein — warna refresh token race
// ho kar rotate/invalidate ho sakta hai.
let refreshPromise: Promise<string | null> | null = null;

// Wrap an axios result in a Web API Response so every existing caller
// (res.ok, res.status, res.json()) keeps working without any change.
const toFetchResponse = (status: number, data: unknown): Response =>
  new Response(data === undefined ? null : JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const refreshAccessToken = async (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await axios.post(
          `${API_URL}/api/auth/refresh`,
          {},
          { withCredentials: true, validateStatus: () => true },
        );
        if (res.status !== 200) return null;
        const newToken = res.data?.accessToken as string | undefined;
        if (newToken) {
          useAuthStore.setState({ token: newToken });
          return newToken;
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
  const token = useAuthStore.getState().token;
  let res = await axios(toAxiosConfig(input, init, token));

  if (res.status !== 401) return toFetchResponse(res.status, res.data);

  // 401 → try a single silent refresh + retry.
  const newToken = await refreshAccessToken();
  if (!newToken) {
    useAuthStore.getState().logout();
    return toFetchResponse(res.status, res.data);
  }

  res = await axios(toAxiosConfig(input, init, newToken));
  return toFetchResponse(res.status, res.data);
};
