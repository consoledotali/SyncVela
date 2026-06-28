import { Server } from "socket.io";
import { AuthenticatedSocket } from "../middlewares/authMiddleware";

// Import isolated handlers
import { registerChannelHandlers } from "./handlers/channelHandler";
import { registerDMHandlers } from "./handlers/dmHandler";
import { registerMessageActionHandlers } from "./handlers/messageActionHandler";

export const handleChatEvents = (io: Server, socket: AuthenticatedSocket) => {
  const userId = socket.user!.userId;

  // Delegate events to their specific domain handlers
  registerChannelHandlers(io, socket, userId);
  registerDMHandlers(io, socket, userId);
  registerMessageActionHandlers(io, socket, userId);
};
