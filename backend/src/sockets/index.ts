import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { createAdapter } from "@socket.io/redis-adapter";
import {
  socketAuthMiddleware,
  AuthenticatedSocket,
} from "../middlewares/authMiddleware";
import { redisClient } from "../config/redis";
import prisma from "../config/db";
import { handleChatEvents } from "./chatHandler";
import { consumeSocketRateLimit, isWorkspaceMember } from "./socketSecurity";
import { allowedOrigins } from "../config/cors";

export const initSocket = async (server: HttpServer) => {
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  if (redisClient?.isReady) {
    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();
    const onAdapterError = (error: unknown) => {
      console.error("[socket-redis-adapter] Pub/Sub client error", error);
    };
    pubClient.on("error", onAdapterError);
    subClient.on("error", onAdapterError);
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    console.log("[socket-redis-adapter] Redis Pub/Sub adapter enabled");
  } else if (process.env.NODE_ENV === "production") {
    throw new Error("Redis Pub/Sub must be ready before Socket.IO starts in production.");
  } else {
    console.warn("[socket-redis-adapter] Redis unavailable; running single-instance only");
  }

  io.use(socketAuthMiddleware);

  io.on("connection", async (socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const userId = authSocket.user?.userId;
    if (!userId) return;

    const getWorkspaceMemberIds = async (subjectUserId: string) => {
      const memberships = await prisma.workspaceMember.findMany({
        where: { userId: subjectUserId },
        select: { workspaceId: true },
      });
      if (memberships.length === 0) return [];
      const peers = await prisma.workspaceMember.findMany({
        where: { workspaceId: { in: memberships.map((membership) => membership.workspaceId) } },
        select: { userId: true },
        distinct: ["userId"],
      });
      return peers.map((peer) => peer.userId);
    };

    const getOnlineWorkspaceMemberIds = async (workspaceId: string) => {
      const workspaceSockets = await io
        .in(`workspace_${workspaceId}`)
        .fetchSockets();

      return [
        ...new Set(
          workspaceSockets
            .map((workspaceSocket) => workspaceSocket.data.userId)
            .filter((connectedUserId): connectedUserId is string =>
              typeof connectedUserId === "string",
            ),
        ),
      ];
    };

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
      await redisClient.set(`syncvela:presence:${userId}`, "online", { EX: 90 });
    }
    await emitPresenceToSharedWorkspaces("userOnline");

    socket.on("presence:heartbeat", async () => {
      if (!(await consumeSocketRateLimit(userId, "presence-heartbeat", 40, 60_000))) return;
      if (redisClient?.isReady) {
        await redisClient.set(`syncvela:presence:${userId}`, "online", { EX: 90 });
      }
    });

    socket.on("requestOnlineUsers", async (workspaceId: unknown) => {
      if (!(await consumeSocketRateLimit(userId, "presence-list", 30, 60_000))) return;
      if (typeof workspaceId !== "string") return;
      if (!(await isWorkspaceMember(userId, workspaceId))) return;
      socket.emit("getOnlineUsers", {
        workspaceId,
        userIds: await getOnlineWorkspaceMemberIds(workspaceId),
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
        if (!(await consumeSocketRateLimit(userId, "join-workspace", 30, 60_000))) {
          callback?.({ error: "Too many join requests" });
          return;
        }
        const membership = await isWorkspaceMember(userId, workspaceId);
        if (!membership) {
          callback?.({ error: "Workspace access denied" });
          return;
        }
        await socket.join(`workspace_${workspaceId}`);
        const onlineUserIds = await getOnlineWorkspaceMemberIds(workspaceId);
        socket.emit("getOnlineUsers", { workspaceId, userIds: onlineUserIds });
        io.to(`workspace_${workspaceId}`).emit("userOnline", userId);
        callback?.({ ok: true, onlineUserIds });
      },
    );

    handleChatEvents(io, authSocket);

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
  });

  return io;
};
