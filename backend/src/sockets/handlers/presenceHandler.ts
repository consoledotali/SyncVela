import { Server } from "socket.io";
import prisma from "../../config/dbConfig";
import { redisClient } from "../../config/redisConfig";
import { AuthenticatedSocket } from "../../types/authTypes";
import { consumeSocketRateLimit, isWorkspaceMember } from "../socketSecurity";

export const getOnlineWorkspaceMemberIds = async (
  io: Server,
  workspaceId: string,
): Promise<string[]> => {
  if (redisClient?.isReady) {
    try {
      const workspaceMembers = await prisma.workspaceMember.findMany({
        where: { workspaceId },
        select: { userId: true },
      });
      if (workspaceMembers.length === 0) return [];
      const userIds = workspaceMembers.map((member) => member.userId);
      const keys = userIds.map((id) => `syncvela:presence:${id}`);
      const presenceStatuses = await redisClient.mGet(keys);
      return userIds.filter(
        (_, index) => presenceStatuses[index] === "online",
      );
    } catch (error) {
      console.error("[presence] Redis lookup error, falling back to sockets", error);
    }
  }

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

  const markUserOnline = async () => {
    if (redisClient?.isReady) {
      try {
        await redisClient.set(`syncvela:presence:${userId}`, "online", {
          EX: 90,
        });
      } catch (error) {
        console.error("[presence] Redis set error", error);
      }
    }
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

  await markUserOnline();
  await emitPresenceToSharedWorkspaces("userOnline");

  socket.on("presence:heartbeat", async () => {
    if (
      !(await consumeSocketRateLimit(
        userId,
        "presence-heartbeat",
        60,
        60_000,
      ))
    )
      return;
    await markUserOnline();
  });

  socket.on("requestOnlineUsers", async (workspaceId: unknown) => {
    if (!(await consumeSocketRateLimit(userId, "presence-list", 60, 60_000)))
      return;
    if (typeof workspaceId !== "string") return;
    if (!(await isWorkspaceMember(userId, workspaceId))) return;
    await markUserOnline();
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
        !(await consumeSocketRateLimit(userId, "join-workspace", 60, 60_000))
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
      await markUserOnline();
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
          try {
            await redisClient.del(`syncvela:presence:${userId}`);
          } catch (error) {
            console.error("[presence] Redis del error", error);
          }
        }
        await emitPresenceToSharedWorkspaces("userOffline");
      }
    }, 3_000);
  });
};

