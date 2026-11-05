const PENDING_INVITE_KEY = "pendingInvite";

function isInvitePath(value: string | null): value is `/invite/${string}` {
  return Boolean(value && /^\/invite\/[A-Za-z0-9_-]+$/.test(value));
}

export function rememberInviteDestination(inviteCode: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PENDING_INVITE_KEY, `/invite/${inviteCode}`);
}

export function consumeInviteDestination(): string | null {
  if (typeof window === "undefined") return null;
  const pendingInvite = window.localStorage.getItem(PENDING_INVITE_KEY);
  if (!isInvitePath(pendingInvite)) return null;
  window.localStorage.removeItem(PENDING_INVITE_KEY);
  return pendingInvite;
}

export function getInviteDestination(): string | null {
  if (typeof window === "undefined") return null;
  const pendingInvite = window.localStorage.getItem(PENDING_INVITE_KEY);
  return isInvitePath(pendingInvite) ? pendingInvite : null;
}
