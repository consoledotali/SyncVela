import { Server } from "socket.io";
import { AuthenticatedSocket } from "../middlewares/authMiddleware";
import prisma from "../config/db";

export const handleChatEvents = (io: Server, socket: AuthenticatedSocket) => {
  const userId = socket.user?.userId;

  // 1. Room Creation & Joining
  socket.on("joinPrivateChat", async (targetUserId) => {
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
            participants: {
              create: [{ userId: userId as string }, { userId: targetUserId }],
            },
          },
        });
        console.log(`🏗️ Naya Private Room banaya: ${conversation.id}`);
      }

      socket.join(conversation.id);
      socket.emit("roomJoined", conversation.id);
      console.log(`🚪 User [${userId}] joined Room [${conversation.id}]`);
    } catch (error) {
      console.error("❌ Room join fail hua:", error);
    }
  });

  // 2. Sending Messages
  socket.on(
    "sendPrivateMessage",
    async (payload: {
      roomId: string;
      text?: string;
      attachmentUrl?: string;
      targetUserId: string;
      tempId?: string;
    }) => {
      try {
        const hasText = payload.text && payload.text.trim() !== "";
        const hasAttachment =
          payload.attachmentUrl && payload.attachmentUrl.trim() !== "";

        if (!hasText && !hasAttachment) {
          console.log(`⚠️ Empty message blocked from User [${userId}]`);
          return;
        }

        const savedMessage = await prisma.message.create({
          data: {
            content: hasText ? payload.text?.trim() : null,
            attachmentUrl: hasAttachment ? payload.attachmentUrl : null,
            senderId: userId as string,
            conversationId: payload.roomId,
          },
        });

        await prisma.conversation.update({
          where: { id: payload.roomId },
          data: { lastMessageAt: savedMessage.createdAt },
        });

        const broadcastPayload = {
          id: savedMessage.id,
          text: savedMessage.content,
          attachmentUrl: savedMessage.attachmentUrl,
          senderId: savedMessage.senderId,
          createdAt: savedMessage.createdAt,
          tempId: payload.tempId,
        };

        // 🛡️ THE GLOBAL ROUTING FIX: Direct to user's personal channel (targets all active tabs)
        io.to(payload.targetUserId).emit("receiveMessage", broadcastPayload);

        if (payload.tempId) {
          socket.emit("messageSentAck", {
            tempId: payload.tempId,
            realId: savedMessage.id,
          });
        }
      } catch (error) {
        console.error("❌ Message fail hua:", error);
      }
    },
  );

  // 4. Mark Room as Read (Watermark Logic)
  socket.on(
    "markAsRead",
    async (payload: { roomId: string; targetUserId: string }) => {
      try {
        if (!payload.roomId) return;

        await prisma.participant.update({
          where: {
            userId_conversationId: {
              userId: userId as string,
              conversationId: payload.roomId,
            },
          },
          data: {
            lastReadAt: new Date(),
          },
        });

        // 🛡️ THE GLOBAL ROUTING FIX
        io.to(payload.targetUserId).emit("messagesRead", {
          roomId: payload.roomId,
        });

        console.log(
          `👀 User [${userId}] marked Room [${payload.roomId}] as read.`,
        );
      } catch (error) {
        console.error("❌ Mark as read failed:", error);
      }
    },
  );

  // 5. NAYA: Mark as Delivered
  socket.on(
    "markAsDelivered",
    (payload: { messageId: string; senderId: string; tempId?: string }) => {
      // 🛡️ THE GLOBAL ROUTING FIX
      io.to(payload.senderId).emit("messageDelivered", {
        messageId: payload.messageId,
        tempId: payload.tempId,
      });
    },
  );

  socket.on("typing", (payload: { targetUserId: string }) => {
    io.to(payload.targetUserId).emit("userTyping", { senderId: userId });
  });

  socket.on("stopTyping", (payload: { targetUserId: string }) => {
    io.to(payload.targetUserId).emit("userStoppedTyping", { senderId: userId });
  });
};
