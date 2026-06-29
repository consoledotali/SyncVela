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
      if (existingMessage.senderId !== userId) {
        if (callback) callback({ error: "Unauthorized" });
        return;
      }

      await prisma.message.delete({ where: { id: payload.messageId } });

      if (payload.isChannel) {
        io.to(`channel_${payload.roomId}`).emit("message_deleted", {
          messageId: payload.messageId,
        });
      } else if (payload.targetUserId) {
        io.to(payload.targetUserId).emit("message_deleted", {
          messageId: payload.messageId,
        });
      }

      if (callback) callback({ status: "ok" });
    } catch (error) {
      console.error("❌ Delete Error:", error);
      if (callback) callback({ error: "Failed to delete" });
    }
  });

  // 🟠 EDIT ENGINE (THE NEW FIX)
  socket.on("edit_message", async (payload: any, callback: any) => {
    try {
      const { messageId, newText, roomId, isChannel, targetUserId } = payload;

      if (!newText || newText.trim() === "") return;

      const existingMessage = await prisma.message.findUnique({
        where: { id: messageId },
      });
      if (!existingMessage) {
        if (callback) callback({ error: "Message not found" });
        return;
      }
      if (existingMessage.senderId !== userId) {
        if (callback) callback({ error: "Unauthorized" });
        return;
      }

      // Update Database
      await prisma.message.update({
        where: { id: messageId },
        data: { content: newText.trim() },
      });

      // Broadcast to specific radar
      const broadcastData = { messageId, newText: newText.trim(), roomId };

      if (isChannel) {
        io.to(`channel_${roomId}`).emit("message_edited", broadcastData);
      } else if (targetUserId) {
        io.to(targetUserId).emit("message_edited", broadcastData);
      }

      if (callback) callback({ status: "ok" });
    } catch (error) {
      console.error("❌ Edit Error:", error);
      if (callback) callback({ error: "Failed to edit" });
    }
  });
};
