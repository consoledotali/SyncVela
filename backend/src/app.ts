import express, { Application } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { corsOriginError, isAllowedOrigin } from "./config/cors";
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import uploadRoutes from "./routes/uploadRoutes";
import workspaceRoutes from "./routes/workspaceRoutes";
import channelRoutes from "./routes/channelRoutes";
import messageRoutes from "./routes/messageRoutes";
import { mutationRateLimit, uploadRateLimit } from "./middlewares/rateLimit";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";

export const createApp = (): Application => {
  const app: Application = express();

  app.set("trust proxy", 1);
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

  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "SyncVela API is running smoothly." });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/users", mutationRateLimit, userRoutes);
  app.use("/api/upload", uploadRateLimit, uploadRoutes);
  app.use("/api/workspaces", mutationRateLimit, workspaceRoutes);
  app.use("/api/channels", mutationRateLimit, channelRoutes);
  app.use("/api/messages", mutationRateLimit, messageRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export const app = createApp();
export default app;

