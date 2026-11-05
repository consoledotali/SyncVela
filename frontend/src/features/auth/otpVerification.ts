export const OTP_LENGTH = 6;

export function normalizeOtp(value: string): string {
  return value.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

export function isValidOtp(value: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(value);
}

export function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) return email;
  if (localPart.length <= 2) return `${localPart[0] ?? ""}*@${domain}`;

  return `${localPart.slice(0, 2)}${"•".repeat(Math.min(localPart.length - 2, 5))}@${domain}`;
}

export function getPostVerificationDestination(): string {
  if (typeof window === "undefined") return "/";
  const pendingInvite = window.localStorage.getItem("pendingInvite");
  if (pendingInvite && /^\/invite\/[A-Za-z0-9_-]+$/.test(pendingInvite)) {
    window.localStorage.removeItem("pendingInvite");
    return pendingInvite;
  }
  return "/";
}
