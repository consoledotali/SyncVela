import "dotenv/config";
import express, { Application } from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { connectRedis, disconnectRedis, requireRedisInProduction } from "./config/redis";
import { corsOriginError, isAllowedOrigin } from "./config/cors";
import { mutationRateLimit, uploadRateLimit } from "./middlewares/rateLimit";

// Routes Import
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import uploadRoutes from "./routes/uploadRoutes";
import workspaceRoutes from "./routes/workspaceRoutes";
import channelRoutes from "./routes/channelRoutes";
import messageRoutes from "./routes/messageRoutes";

// Socket Engine Import
import { initSocket } from "./sockets/index";

requireRedisInProduction();

const app: Application = express();

// Trust the first reverse-proxy hop so rate limits use the client IP.
app.set("trust proxy", 1);
const server = http.createServer(app);

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(corsOriginError());
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", mutationRateLimit, userRoutes);
app.use("/api/upload", uploadRateLimit, uploadRoutes);
app.use("/api/workspaces", mutationRateLimit, workspaceRoutes);
app.use("/api/channels", mutationRateLimit, channelRoutes);
app.use("/api/messages", mutationRateLimit, messageRoutes);

// Health Check
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "SyncVela API is running smoothly." });
});

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
