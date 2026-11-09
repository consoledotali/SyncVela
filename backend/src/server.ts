import "dotenv/config";
import http from "http";
import { app } from "./app";
import { connectRedis, disconnectRedis, requireRedisInProduction } from "./config/redisConfig";
import { initSocket } from "./sockets/index";

requireRedisInProduction();

const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

void connectRedis().then(async (redisConnected) => {
  if (process.env.NODE_ENV === "production" && !redisConnected) {
    throw new Error("Redis is required for production Socket.IO Pub/Sub and distributed rate limiting.");
  }
  if (redisConnected) {
    console.log("[redis] base client connected; Socket.IO Pub/Sub can initialize");
  }
  const io = await initSocket(server);
  app.set("socketio", io);
  server.listen(PORT, () => {
    console.log(`SyncVela API listening on port ${PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[server] ${signal} received; shutting down gracefully`);
    server.close(async () => {
      try {
        await disconnectRedis();
      } finally {
        process.exit(0);
      }
    });
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}).catch((error) => {
  console.error("Failed to initialize SyncVela API", error);
  process.exit(1);
});
