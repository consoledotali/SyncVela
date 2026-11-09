import { Server } from "socket.io";
import prisma from "../../config/dbConfig";
import { redisClient } from "../../config/redisConfig";
import { AuthenticatedSocket } from "../../types/authTypes";
import { consumeSocketRateLimit, isWorkspaceMember } from "../socketSecurity";

export const getOnlineWorkspaceMemberIds = async (
  io: Server,
  workspaceId: string,
): Promise<string[]> => {
  const workspaceSockets = await io
    .in(`workspace_${workspaceId}`)
    .fetchSockets();

  return [
    ...new Set(
      workspaceSockets
        .map((workspaceSocket) => workspaceSocket.data.userId)
        .filter(
          (connectedUserId): connectedUserId is string =>
            typeof connectedUserId === "string",
        ),
    ),
  ];
};

export const registerPresenceHandlers = async (
  io: Server,
  socket: AuthenticatedSocket,
  userId: string,
): Promise<void> => {
  const emitPresenceToSharedWorkspaces = async (
    event: "userOnline" | "userOffline",
  ) => {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true },
    });
    memberships.forEach(({ workspaceId }) => {
      io.to(`workspace_${workspaceId}`).emit(event, userId);
    });
  };

  socket.data.userId = userId;
  await socket.join(userId);

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    select: { workspaceId: true },
  });
  await socket.join(
    memberships.map(({ workspaceId }) => `workspace_${workspaceId}`),
  );

  if (redisClient?.isOpen) {
    await redisClient.set(`syncvela:presence:${userId}`, "online", {
      EX: 90,
    });
  }
  await emitPresenceToSharedWorkspaces("userOnline");

  socket.on("presence:heartbeat", async () => {
    if (
      !(await consumeSocketRateLimit(
        userId,
        "presence-heartbeat",
        40,
        60_000,
      ))
    )
      return;
    if (redisClient?.isReady) {
      await redisClient.set(`syncvela:presence:${userId}`, "online", {
        EX: 90,
      });
    }
  });

  socket.on("requestOnlineUsers", async (workspaceId: unknown) => {
    if (!(await consumeSocketRateLimit(userId, "presence-list", 30, 60_000)))
      return;
    if (typeof workspaceId !== "string") return;
    if (!(await isWorkspaceMember(userId, workspaceId))) return;
    socket.emit("getOnlineUsers", {
      workspaceId,
      userIds: await getOnlineWorkspaceMemberIds(io, workspaceId),
    });
  });

  socket.on(
    "join_workspace",
    async (
      workspaceId: string,
      callback?: (result: {
        error?: string;
        ok?: true;
        onlineUserIds?: string[];
      }) => void,
    ) => {
      if (
        !(await consumeSocketRateLimit(userId, "join-workspace", 30, 60_000))
      ) {
        callback?.({ error: "Too many join requests" });
        return;
      }
      const membership = await isWorkspaceMember(userId, workspaceId);
      if (!membership) {
        callback?.({ error: "Workspace access denied" });
        return;
      }
      await socket.join(`workspace_${workspaceId}`);
      const onlineUserIds = await getOnlineWorkspaceMemberIds(io, workspaceId);
      socket.emit("getOnlineUsers", { workspaceId, userIds: onlineUserIds });
      io.to(`workspace_${workspaceId}`).emit("userOnline", userId);
      callback?.({ ok: true, onlineUserIds });
    },
  );

  socket.on("disconnect", () => {
    setTimeout(async () => {
      const activeSockets = await io.in(userId).fetchSockets();
      if (activeSockets.length === 0) {
        if (redisClient?.isReady) {
          await redisClient.del(`syncvela:presence:${userId}`);
        }
        await emitPresenceToSharedWorkspaces("userOffline");
      }
    }, 3_000);
  });
};

