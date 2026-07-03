import { Server, Socket } from "socket.io";
import prisma from "../../config/db";

export const registerChannelHandlers = (
  io: Server,
  socket: Socket,
  userId: string,
) => {
  socket.on("join_channel", (channelId: string) => {
    socket.join(`channel_${channelId}`);
  });

  socket.on("leave_channel", (channelId: string) => {
    socket.leave(`channel_${channelId}`);
  });

  socket.on("send_channel_message", async (payload: any, callback: any) => {
    try {
      const textData = payload.text || payload.content;
      const { channelId, attachmentUrl, tempId } = payload;

      const hasText = textData && textData.trim() !== "";
      const hasAttachment = attachmentUrl && attachmentUrl.trim() !== "";

      if (!channelId || (!hasText && !hasAttachment)) return;

      const message = await prisma.message.create({
        data: {
          content: hasText ? textData.trim() : null,
          attachmentUrl: hasAttachment ? attachmentUrl : null,
          channelId,
          senderId: userId,
        },
        include: {
          sender: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      const broadcastPayload = { ...message, tempId };
      io.to(`channel_${channelId}`).emit(
        "receive_channel_message",
        broadcastPayload,
      );

      if (tempId) {
        socket.emit("messageSentAck", { tempId, realId: message.id });
      }

      if (callback) callback({ status: "ok", realId: message.id, tempId });
    } catch (error) {
      console.error("\n❌❌❌ [CHANNEL] PRISMA DATABASE CRASH ❌❌❌", error);
      if (callback) callback({ error: "Failed to send message" });
    }
  });

  socket.on(
    "markChannelAsRead",
    async ({ channelId }: { channelId: string }) => {
      try {
        await prisma.channelMember.upsert({
          where: {
            userId_channelId: { userId, channelId },
          },
          update: { lastReadAt: new Date() },
          create: { userId, channelId, lastReadAt: new Date() },
        });
      } catch (error) {
        console.error("❌ Failed to mark channel as read:", error);
      }
    },
  );

  // 🟢 THE REAL-TIME RELAY: Invited users ko notify karo
  socket.on("notify_channel_invites", ({ channel, userIds }) => {
    if (!channel || !userIds || !Array.isArray(userIds)) return;

    userIds.forEach((targetUserId: string) => {
      io.to(targetUserId).emit("added_to_channel", channel);
    });
  });
};
