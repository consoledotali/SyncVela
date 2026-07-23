import { Server, Socket } from "socket.io";
import prisma from "../../config/db";

export const registerMessageActionHandlers = (
  io: Server,
  socket: Socket,
  userId: string,
) => {
  // 🔴 DELETION ENGINE (WITH GOD MODE)
  socket.on("delete_message", async (payload: any, callback: any) => {
    try {
      const { messageId, roomId, isChannel, targetUserId } = payload;

      const existingMessage = await prisma.message.findUnique({
        where: { id: messageId },
      });
      if (!existingMessage) {
        if (callback) callback({ error: "Message not found" });
        return;
      }

      // 🚀 THE GOD MODE GATEKEEPER
      let isAuthorized = existingMessage.senderId === userId;

      // Agar message apna nahi hai, aur Channel ka message hai, tab RBAC check karo
      if (!isAuthorized && isChannel) {
        const channel = await prisma.channel.findUnique({
          where: { id: roomId },
          select: { workspaceId: true },
        });

        if (channel) {
          const member = await prisma.workspaceMember.findUnique({
            where: {
              userId_workspaceId: { userId, workspaceId: channel.workspaceId },
            },
            select: { role: true },
          });

          if (member && (member.role === "OWNER" || member.role === "ADMIN")) {
            isAuthorized = true; // God Mode Activated
          }
        }
      }

      if (!isAuthorized) {
        if (callback)
          callback({
            error:
              "Unauthorized: You don't have permission to moderate this message.",
          });
        return;
      }

      await prisma.message.delete({ where: { id: messageId } });

      const broadcastData = {
        messageId,
        roomId,
        isChannel,
        senderId: existingMessage.senderId, // 🛡️ STRICT FIX: Notify using original sender's ID so unread badges sync correctly
        parentMessageId: existingMessage.parentMessageId, // 🚀 THREAD COUNT FIX: Client uses this to decrement parent's reply badge
      };

      if (isChannel) {
        io.to(`channel_${roomId}`).emit("message_deleted", broadcastData);
      } else if (targetUserId) {
        io.to(targetUserId).emit("message_deleted", broadcastData);
        socket.emit("message_deleted", broadcastData);
      }

      if (callback) callback({ status: "ok" });
    } catch (error) {
      console.error("❌ Delete Error:", error);
      if (callback) callback({ error: "Failed to delete" });
    }
  });

  // 🟠 EDIT ENGINE (STRICTLY 'isMe' ONLY - No God Mode for editing)
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

      // 🛡️ Edit hamesha sirf sender kar sakta hai
      if (existingMessage.senderId !== userId) {
        if (callback) callback({ error: "Unauthorized" });
        return;
      }

      await prisma.message.update({
        where: { id: messageId },
        data: { content: newText.trim() },
      });

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
