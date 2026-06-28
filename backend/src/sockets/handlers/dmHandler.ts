import { Server, Socket } from "socket.io";
import prisma from "../../config/db";

export const registerDMHandlers = (
  io: Server,
  socket: Socket,
  userId: string,
) => {
  socket.on("joinPrivateChat", async (targetUserId: string) => {
    try {
      let conversation = await prisma.conversation.findFirst({
        where: {
          isGroup: false,
          AND: [
            { participants: { some: { userId: userId } } },
            { participants: { some: { userId: targetUserId } } },
          ],
        },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            isGroup: false,
            participants: { create: [{ userId }, { userId: targetUserId }] },
          },
        });
      }

      socket.join(`dm_${conversation.id}`);
      socket.emit("roomJoined", conversation.id);
    } catch (error) {
      console.error("❌ [DM] Room Join Failed:", error);
    }
  });

  // 🛡️ THE FIX: Changed event name to "sendMessage" to match ChatInput.tsx
  socket.on("sendMessage", async (payload: any) => {
    try {
      const { roomId, targetUserId, message } = payload;
      if (!roomId || !message) return;

      // Extract from the nested message object
      const textData = message.text || message.content;
      const attachmentUrl = message.attachmentUrl;
      const tempId = message.tempId;

      const hasText = textData && textData.trim() !== "";
      const hasAttachment = attachmentUrl && attachmentUrl.trim() !== "";

      if (!hasText && !hasAttachment) return;

      const savedMessage = await prisma.message.create({
        data: {
          content: hasText ? textData.trim() : null,
          attachmentUrl: hasAttachment ? attachmentUrl : null,
          senderId: userId,
          conversationId: roomId,
        },
      });

      await prisma.conversation.update({
        where: { id: roomId },
        data: { lastMessageAt: savedMessage.createdAt },
      });

      const broadcastPayload = {
        id: savedMessage.id,
        text: savedMessage.content,
        attachmentUrl: savedMessage.attachmentUrl,
        senderId: savedMessage.senderId,
        createdAt: savedMessage.createdAt,
        tempId: tempId,
      };

      io.to(targetUserId).emit("receiveMessage", broadcastPayload);

      if (tempId) {
        socket.emit("messageSentAck", {
          tempId: tempId,
          realId: savedMessage.id,
        });
      }
    } catch (error) {
      console.error("❌ [DM] Routing Failed:", error);
    }
  });

  socket.on(
    "markAsRead",
    async (payload: { roomId: string; targetUserId: string }) => {
      try {
        await prisma.participant.update({
          where: {
            userId_conversationId: { userId, conversationId: payload.roomId },
          },
          data: { lastReadAt: new Date() },
        });
        io.to(payload.targetUserId).emit("messagesRead", {
          roomId: payload.roomId,
        });
      } catch (error) {}
    },
  );

  socket.on("markAsDelivered", (payload: any) => {
    io.to(payload.senderId).emit("messageDelivered", {
      messageId: payload.messageId,
      tempId: payload.tempId,
    });
  });

  socket.on("typing", (payload: any) =>
    io.to(payload.targetUserId).emit("userTyping", { senderId: userId }),
  );
  socket.on("stopTyping", (payload: any) =>
    io.to(payload.targetUserId).emit("userStoppedTyping", { senderId: userId }),
  );
};
