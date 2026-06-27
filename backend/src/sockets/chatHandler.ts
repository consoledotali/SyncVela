import { Server } from "socket.io";
import { AuthenticatedSocket } from "../middlewares/authMiddleware";
import prisma from "../config/db";

export const handleChatEvents = (io: Server, socket: AuthenticatedSocket) => {
  const userId = socket.user!.userId;

  // ==========================================
  // 🟢 PART 1: WORKSPACE CHANNELS (SLACK ARCHITECTURE)
  // ==========================================

  socket.on("join_channel", (channelId: string) => {
    socket.join(`channel_${channelId}`);
    console.log(`🚪 [CHANNEL] User ${userId} joined: ${channelId}`);
  });

  socket.on("leave_channel", (channelId: string) => {
    socket.leave(`channel_${channelId}`);
    console.log(`👋 [CHANNEL] User ${userId} left: ${channelId}`);
  });

  socket.on(
    "send_channel_message",
    async (
      payload: {
        channelId: string;
        content?: string;
        attachmentUrl?: string;
        tempId?: string;
      },
      callback,
    ) => {
      try {
        const { channelId, content, attachmentUrl, tempId } = payload;

        const hasText = content && content.trim() !== "";
        const hasAttachment = attachmentUrl && attachmentUrl.trim() !== "";

        if (!channelId || (!hasText && !hasAttachment)) return;

        const message = await prisma.message.create({
          data: {
            content: hasText ? content.trim() : null,
            attachmentUrl: hasAttachment ? attachmentUrl : null,
            channelId,
            senderId: userId,
          },
          include: {
            sender: { select: { id: true, name: true, avatarUrl: true } },
          },
        });

        // 🛡️ THE OPTIMISTIC UI FIX: Return the tempId to the frontend
        const broadcastPayload = {
          ...message,
          tempId: tempId,
        };

        // Broadcast to specific channel room
        io.to(`channel_${channelId}`).emit(
          "receive_channel_message",
          broadcastPayload,
        );

        if (callback) callback({ status: "ok", realId: message.id, tempId });
      } catch (error) {
        console.error("❌ [CHANNEL] Message Routing Failed:", error);
        if (callback) callback({ error: "Failed to send message" });
      }
    },
  );

  // ==========================================
  // 🔵 PART 2: PRIVATE DIRECT MESSAGES (WHATSAPP ARCHITECTURE)
  // ==========================================

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
            participants: {
              create: [{ userId }, { userId: targetUserId }],
            },
          },
        });
      }

      socket.join(`dm_${conversation.id}`);
      socket.emit("roomJoined", conversation.id);
    } catch (error) {
      console.error("❌ [DM] Private Room Join Failed:", error);
    }
  });

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

        if (!hasText && !hasAttachment) return;

        const savedMessage = await prisma.message.create({
          data: {
            content: hasText ? payload.text?.trim() : null,
            attachmentUrl: hasAttachment ? payload.attachmentUrl : null,
            senderId: userId,
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

        io.to(payload.targetUserId).emit("receiveMessage", broadcastPayload);

        if (payload.tempId) {
          socket.emit("messageSentAck", {
            tempId: payload.tempId,
            realId: savedMessage.id,
          });
        }
      } catch (error) {
        console.error("❌ [DM] Message Routing Failed:", error);
      }
    },
  );

  // ==========================================
  // 🟡 PART 3: READ RECEIPTS & TYPING INDICATORS
  // ==========================================

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
      } catch (error) {
        console.error("❌ Mark as read failed:", error);
      }
    },
  );

  socket.on(
    "markAsDelivered",
    (payload: { messageId: string; senderId: string; tempId?: string }) => {
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
