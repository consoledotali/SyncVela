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

  socket.on("sendPrivateMessage", async (payload: any) => {
    try {
      const { roomId, text, attachmentUrl, targetUserId, tempId } = payload;

      const hasText = text && text.trim() !== "";
      const hasAttachment = attachmentUrl && attachmentUrl.trim() !== "";

      if (!hasText && !hasAttachment) return;

      // 🟢 THE SENDER FIX (Jo tum ne pichli dafa ignore kar diya tha)
      const savedMessage = await prisma.message.create({
        data: {
          content: hasText ? text.trim() : null,
          attachmentUrl: hasAttachment ? attachmentUrl : null,
          senderId: userId,
          conversationId: roomId,
        },
        include: {
          sender: { select: { id: true, name: true, avatarUrl: true } },
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
        status: "delivered",
        sender: savedMessage.sender, // 🟢 SENDER DETAILS NOW BROADCASTED
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
        const serverReadTime = new Date();
        await prisma.participant.update({
          where: {
            userId_conversationId: { userId, conversationId: payload.roomId },
          },
          data: { lastReadAt: serverReadTime },
        });

        // 🔵 CLOCK SKEW FIX: Sending absolute server time
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
