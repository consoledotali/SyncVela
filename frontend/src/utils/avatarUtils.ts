const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export const resolveAvatarUrl = (avatarUrl?: string | null): string | undefined => {
  if (!avatarUrl) return undefined;

  try {
    const parsed = new URL(avatarUrl);
    const avatarPathIndex = parsed.pathname.indexOf("/avatars/");
    if (avatarPathIndex === -1) return avatarUrl;

    const fileKey = parsed.pathname.slice(avatarPathIndex + 1);
    return `${API_BASE_URL}/api/users/avatar-object?key=${encodeURIComponent(fileKey)}`;
  } catch {
    return avatarUrl;
  }
};
