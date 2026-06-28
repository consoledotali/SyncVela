import { Server, Socket } from "socket.io";
import prisma from "../../config/db";

export const registerChannelHandlers = (io: Server, socket: Socket, userId: string) => {
  socket.on("join_channel", (channelId: string) => {
    socket.join(`channel_${channelId}`);
  });

  socket.on("leave_channel", (channelId: string) => {
    socket.leave(`channel_${channelId}`);
  });

  socket.on("send_channel_message", async (payload: any, callback: any) => {
    try {
      console.log(`\n🚀 [CHANNEL] Incoming Message Payload:`, payload);

      const textData = payload.text || payload.content;
      const { channelId, attachmentUrl, tempId } = payload;
      
      const hasText = textData && textData.trim() !== "";
      const hasAttachment = attachmentUrl && attachmentUrl.trim() !== "";

      if (!channelId || (!hasText && !hasAttachment)) {
        console.log("⚠️ [CHANNEL] Aborted: Missing Channel ID or Empty Content.");
        return;
      }

      console.log(`⏳ [CHANNEL] Attempting Prisma Save for Channel: ${channelId}...`);
      
      const message = await prisma.message.create({
        data: {
          content: hasText ? textData.trim() : null,
          attachmentUrl: hasAttachment ? attachmentUrl : null,
          channelId,
          senderId: userId,
        },
        include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
      });

      console.log(`✅ [CHANNEL] DB Save Success! Real ID: ${message.id}`);

      const broadcastPayload = { ...message, tempId };
      io.to(`channel_${channelId}`).emit("receive_channel_message", broadcastPayload);

      // 🛡️ THE MISSING ACKNOWLEDGMENT FIX: DM ki tarah Channel mein bhi UI ko ticket wapas karo
      if (tempId) {
        socket.emit("messageSentAck", { tempId, realId: message.id });
      }

      if (callback) callback({ status: "ok", realId: message.id, tempId });
    } catch (error) {
      // 🔴 THE BRUTAL TRUTH LOGGER: Agar Prisma phata toh yahan cheekhega
      console.error("\n❌❌❌ [CHANNEL] PRISMA DATABASE CRASH ❌❌❌");
      console.error(error);
      if (callback) callback({ error: "Failed to send message" });
    }
  });
};