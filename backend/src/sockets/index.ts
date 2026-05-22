import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import {
  socketAuthMiddleware,
  AuthenticatedSocket,
} from "../middlewares/authMiddleware";
import { handleChatEvents } from "./chatHandler";

const onlineUsers = new Set<string>();

export const initSocket = (server: HttpServer) => {
  const io = new Server(server, {
    cors: { origin: "http://localhost:3000", methods: ["GET", "POST"] },
  });

  io.use(socketAuthMiddleware);

  io.on("connection", async (socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const userId = authSocket.user?.userId;

    if (!userId) return;

    socket.join(userId);

    const matchingSockets = await io.in(userId).fetchSockets();
    if (matchingSockets.length === 1) {
      console.log(`🟢 User Online: ${userId}`);
      onlineUsers.add(userId);
      socket.broadcast.emit("userOnline", userId);
    }

    // 🛡️ THE ARCHITECT FIX: Ab server andha-dhund list nahi bhejega.
    // Jab frontend tayyar hoga, wo 'requestOnlineUsers' mangega, tab hum denge.
    socket.on("requestOnlineUsers", () => {
      socket.emit("getOnlineUsers", Array.from(onlineUsers));
    });

    handleChatEvents(io, authSocket);

    socket.on("disconnect", () => {
      setTimeout(async () => {
        const activeSockets = await io.in(userId).fetchSockets();
        if (activeSockets.length === 0) {
          console.log(`🔴 User Offline: ${userId}`);
          onlineUsers.delete(userId);
          io.emit("userOffline", userId);
        }
      }, 500);
    });
  });

  return io;
};
