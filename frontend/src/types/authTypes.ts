export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  provider?: "LOCAL" | "GOOGLE";
  hasPassword?: boolean;
}

export type AuthenticatedUser = User;

export interface RefreshSession {
  accessToken: string;
  user: User;
}

export type OtpResponse = {
  status: number;
  data: unknown;
};

export type OtpRequest = (
  url: string,
  payload: { email: string; otp: string },
) => Promise<OtpResponse>;

export interface VerifyOtpSessionOptions {
  apiUrl: string;
  email: string;
  otp: string;
  request: OtpRequest;
  onAuthenticated: (user: AuthenticatedUser, accessToken: string) => void;
}

