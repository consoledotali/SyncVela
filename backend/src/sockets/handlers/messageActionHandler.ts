import { Server, Socket } from "socket.io";
import prisma from "../../config/db";

export const registerMessageActionHandlers = (
  io: Server,
  socket: Socket,
  userId: string,
) => {
  // 🔴 DELETION ENGINE
  socket.on("delete_message", async (payload: any, callback: any) => {
    try {
      const existingMessage = await prisma.message.findUnique({
        where: { id: payload.messageId },
      });

      if (!existingMessage) {
        if (callback) callback({ error: "Message not found" });
        return;
      }

      // Security validation
      if (existingMessage.senderId !== userId) {
        if (callback) callback({ error: "Unauthorized" });
        return;
      }

      await prisma.message.delete({
        where: { id: payload.messageId },
      });

      if (payload.isChannel) {
        io.to(`channel_${payload.roomId}`).emit("message_deleted", {
          messageId: payload.messageId,
          channelId: payload.roomId,
        });
      } else {
        if (payload.targetUserId) {
          io.to(payload.targetUserId).emit("message_deleted", {
            messageId: payload.messageId,
            roomId: payload.roomId,
          });
        }
      }

      if (callback) callback({ status: "ok" });
    } catch (error) {
      console.error("❌ Delete Error:", error);
      if (callback) callback({ error: "Failed to delete" });
    }
  });
};
