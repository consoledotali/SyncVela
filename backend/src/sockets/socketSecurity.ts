import prisma from "../config/dbConfig";
import { redisClient } from "../config/redisConfig";

export async function isWorkspaceMember(userId: string, workspaceId: string) {
  return prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { role: true },
  });
}

export async function canAccessChannel(userId: string, channelId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true, workspaceId: true, type: true },
  });
  if (!channel) return null;

  const workspaceMember = await isWorkspaceMember(userId, channel.workspaceId);
  if (!workspaceMember) return null;

  if (channel.type !== "PRIVATE") return channel;

  const channelMember = await prisma.channelMember.findUnique({
    where: { userId_channelId: { userId, channelId } },
    select: { userId: true },
  });
  return channelMember ? channel : null;
}

export async function consumeSocketRateLimit(
  userId: string,
  event: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  if (!redisClient?.isReady) return process.env.NODE_ENV !== "production";

  try {
    const key = `syncvela:socket-rate:${event}:${userId}`;
    const count = await redisClient.incr(key);
    if (count === 1) await redisClient.pExpire(key, windowMs);
    return count <= limit;
  } catch {
    return process.env.NODE_ENV !== "production";
  }
}
