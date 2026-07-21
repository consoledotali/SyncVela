import { Server, Socket } from "socket.io";
import prisma from "../../config/db";
import { signAttachments } from "../../utils/s3";

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

      // 🚀 THREADING ENGINE: Extract parentMessageId from frontend payload
      const { channelId, attachments, tempId, parentMessageId } = payload;

      const hasText = textData && textData.trim() !== "";
      const hasAttachments =
        Array.isArray(attachments) && attachments.length > 0;

      if (!channelId || (!hasText && !hasAttachments)) return;

      // 🛡️ AUTHORIZATION: Sender ko is channel ka member hona chahiye.
      // PUBLIC channel ke liye workspace-member kaafi, PRIVATE ke liye ChannelMember.
      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        select: { workspaceId: true, type: true },
      });
      if (!channel) {
        if (callback) callback({ error: "Channel not found" });
        return;
      }

      const workspaceMember = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: { userId, workspaceId: channel.workspaceId },
        },
        select: { userId: true },
      });
      if (!workspaceMember) {
        if (callback)
          callback({ error: "You are not a member of this workspace." });
        return;
      }

      if (channel.type === "PRIVATE") {
        const channelMember = await prisma.channelMember.findUnique({
          where: { userId_channelId: { userId, channelId } },
          select: { userId: true },
        });
        if (!channelMember) {
          if (callback)
            callback({ error: "You don't have access to this channel." });
          return;
        }
      }

      const message = await prisma.message.create({
        data: {
          content: hasText ? textData.trim() : null,
          channelId,
          senderId: userId,

          // 🚀 THE THREAD LINK: Null if normal message, ID if it's a reply
          parentMessageId: parentMessageId || null,

          attachments: hasAttachments
            ? {
                create: attachments.map((att: any) => ({
                  url: att.url,
                  fileKey: att.fileKey || null,
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

      // Replace stored keys with short-lived signed URLs before broadcasting.
      const signedMessage = {
        ...message,
        attachments: await signAttachments(message.attachments),
      };

      const broadcastPayload = { ...signedMessage, tempId };
      io.to(`channel_${channelId}`).emit(
        "receive_channel_message",
        broadcastPayload,
      );

      if (tempId) {
        socket.emit("messageSentAck", { tempId, realId: message.id });
      }

      if (callback) callback({ status: "ok", realId: message.id, tempId });
    } catch (error) {
      console.error(
        "\n❌❌❌ [CHANNEL] PRISMA RELATIONAL DATABASE CRASH ❌❌❌",
        error,
      );
      if (callback) callback({ error: "Failed to send message" });
    }
  });

  socket.on(
    "markChannelAsRead",
    async ({ channelId }: { channelId: string }) => {
      try {
        await prisma.channelMember.upsert({
          where: { userId_channelId: { userId, channelId } },
          update: { lastReadAt: new Date() },
          create: { userId, channelId, lastReadAt: new Date() },
        });
      } catch (error) {
        console.error("❌ Failed to mark channel as read:", error);
      }
    },
  );

  socket.on("notify_channel_invites", ({ channel, userIds }) => {
    if (!channel || !userIds || !Array.isArray(userIds)) return;
    userIds.forEach((targetUserId: string) => {
      io.to(targetUserId).emit("added_to_channel", channel);
    });
  });
};
