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

  socket.on("sendPrivateMessage", async (payload: any, callback: any) => {
    try {
      const { roomId, targetUserId, text, attachments, tempId } = payload;
      const textData = text || payload.content;

      const hasText = textData && textData.trim() !== "";
      const hasAttachments =
        Array.isArray(attachments) && attachments.length > 0;

      if (!targetUserId || (!hasText && !hasAttachments)) return;

      let validConversationId = roomId;

      if (roomId) {
        const existingConvo = await prisma.conversation.findUnique({
          where: { id: roomId },
          select: { id: true },
        });
        if (!existingConvo) validConversationId = null;
      }

      if (!validConversationId) {
        let fallbackConvo = await prisma.conversation.findFirst({
          where: {
            isGroup: false,
            AND: [
              { participants: { some: { userId: userId } } },
              { participants: { some: { userId: targetUserId } } },
            ],
          },
        });

        if (!fallbackConvo) {
          fallbackConvo = await prisma.conversation.create({
            data: {
              isGroup: false,
              participants: {
                create: [{ userId: userId }, { userId: targetUserId }],
              },
            },
          });
        }
        validConversationId = fallbackConvo.id;
      }

      const savedMessage = await prisma.message.create({
        data: {
          content: hasText ? textData.trim() : null,
          senderId: userId,
          conversationId: validConversationId,
          attachments: hasAttachments
            ? {
                create: attachments.map((att: any) => ({
                  url: att.url,
                  fileName: att.fileName || "attachment",
                  mimeType: att.mimeType || "application/octet-stream",
                  size: att.size || 0,
                })),
              }
            : undefined,
        },
        include: {
          sender: { select: { id: true, name: true, avatarUrl: true } },
          attachments: true,
        },
      });

      const broadcastPayload = { ...savedMessage, tempId };
      socket.emit("receiveMessage", broadcastPayload);
      io.to(targetUserId).emit("receiveMessage", broadcastPayload);

      if (tempId) {
        socket.emit("messageSentAck", { tempId, realId: savedMessage.id });
      }

      if (callback) callback({ status: "ok", realId: savedMessage.id, tempId });
    } catch (error) {
      console.error(
        "\n❌❌❌ [DM] PRISMA RELATIONAL DATABASE CRASH ❌❌❌",
        error,
      );
      if (callback) callback({ error: "Failed to send private message" });
    }
  });

  socket.on(
    "markAsRead",
    async (payload: { roomId: string; targetUserId: string }) => {
      try {
        const serverReadTime = new Date();
        await prisma.participant.update({
          where: {
            userId_conversationId: { userId, conversationId: payload.roomId },
          },
          data: { lastReadAt: serverReadTime },
        });
        io.to(payload.targetUserId).emit("messagesRead", {
          roomId: payload.roomId,
          readAt: serverReadTime.toISOString(),
        });
      } catch (error) {
        console.error("❌ Mark as read failed:", error);
      }
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
