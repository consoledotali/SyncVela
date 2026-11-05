import { getPostVerificationDestination } from "./otpVerification";

type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  provider?: "LOCAL" | "GOOGLE";
  hasPassword?: boolean;
};

type OtpResponse = {
  status: number;
  data: unknown;
};

type OtpRequest = (url: string, payload: { email: string; otp: string }) => Promise<OtpResponse>;

type VerifyOtpSessionOptions = {
  apiUrl: string;
  email: string;
  otp: string;
  request: OtpRequest;
  onAuthenticated: (user: AuthenticatedUser, accessToken: string) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSuccessfulSession(data: unknown): { user: AuthenticatedUser; accessToken: string } | null {
  if (!isRecord(data) || !isRecord(data.user)) return null;

  const accessToken = typeof data.accessToken === "string"
    ? data.accessToken
    : isRecord(data.tokens) && typeof data.tokens.accessToken === "string"
      ? data.tokens.accessToken
      : null;

  if (
    !accessToken ||
    typeof data.user.id !== "string" ||
    typeof data.user.name !== "string" ||
    typeof data.user.email !== "string"
  ) {
    return null;
  }

  return {
    user: {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      avatarUrl: typeof data.user.avatarUrl === "string" || data.user.avatarUrl === null ? data.user.avatarUrl : undefined,
      provider: data.user.provider === "LOCAL" || data.user.provider === "GOOGLE" ? data.user.provider : undefined,
      hasPassword: typeof data.user.hasPassword === "boolean" ? data.user.hasPassword : undefined,
    },
    accessToken,
  };
}

function getErrorMessage(data: unknown): string {
  return isRecord(data) && typeof data.error === "string"
    ? data.error
    : "We could not verify that code. Please try again.";
}

export async function verifyOtpSession({
  apiUrl,
  email,
  otp,
  request,
  onAuthenticated,
}: VerifyOtpSessionOptions): Promise<string> {
  const response = await request(`${apiUrl}/api/auth/verify-otp`, { email, otp });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(getErrorMessage(response.data));
  }

  const session = parseSuccessfulSession(response.data);
  if (!session) {
    throw new Error("Verification succeeded, but the sign-in session was incomplete. Please sign in again.");
  }

  onAuthenticated(session.user, session.accessToken);
  return getPostVerificationDestination();
}
