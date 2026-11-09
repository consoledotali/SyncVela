import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { createAdapter } from "@socket.io/redis-adapter";
import { socketAuthMiddleware } from "../middlewares/authMiddleware";
import { AuthenticatedSocket } from "../types/authTypes";
import { redisClient } from "../config/redisConfig";
import { allowedOrigins } from "../config/corsConfig";
import { registerPresenceHandlers } from "./handlers/presenceHandler";
import { registerChannelHandlers } from "./handlers/channelHandler";
import { registerDirectMessageHandlers } from "./handlers/directMessageHandler";
import { registerMessageActionHandlers } from "./handlers/messageActionHandler";

export const initSocket = async (server: HttpServer): Promise<Server> => {
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
    throw new Error(
      "Redis Pub/Sub must be ready before Socket.IO starts in production.",
    );
  } else {
    console.warn(
      "[socket-redis-adapter] Redis unavailable; running single-instance only",
    );
  }

  io.use(socketAuthMiddleware);

  io.on("connection", async (socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const userId = authSocket.user?.userId;
    if (!userId) return;

    await registerPresenceHandlers(io, authSocket, userId);
    registerChannelHandlers(io, authSocket, userId);
    registerDirectMessageHandlers(io, authSocket, userId);
    registerMessageActionHandlers(io, authSocket, userId);
  });

  return io;
};

export default initSocket;

