import { Server, Socket } from "socket.io";
import prisma from "../../config/db";
import {
  channelIdPayloadSchema,
  channelMessagePayloadSchema,
  socketIdentifierSchema,
} from "../../validators/socketValidators";
import { signAttachments } from "../../services/storageService";
import { authorizeRBAC } from "../../utils/rbac";
import { canAccessChannel, consumeSocketRateLimit } from "../socketSecurity";

export const registerChannelHandlers = (
  io: Server,
  socket: Socket,
  userId: string,
) => {
  socket.on("join_channel", async (channelId: string, callback?: (result: { error?: string; ok?: true }) => void) => {
    const parsed = socketIdentifierSchema.safeParse(channelId);
    if (!parsed.success) {
      callback?.({ error: "A valid channel is required" });
      return;
    }
    if (!(await consumeSocketRateLimit(userId, "channel-join", 30, 60_000))) {
      callback?.({ error: "Join rate limit exceeded" });
      return;
    }
    const channel = await canAccessChannel(userId, parsed.data);
    if (!channel) {
      callback?.({ error: "Channel access denied" });
      return;
    }
    socket.join(`channel_${parsed.data}`);
    callback?.({ ok: true });
  });

  socket.on("leave_channel", async (channelId: string) => {
    const parsed = socketIdentifierSchema.safeParse(channelId);
    if (!parsed.success) return;
    if (!(await consumeSocketRateLimit(userId, "channel-leave", 60, 60_000))) return;
    socket.leave(`channel_${parsed.data}`);
  });

  const broadcastChannelTyping = async (
    payload: unknown,
    eventName: "channel_typing" | "channel_stop_typing",
  ) => {
    const parsed = channelIdPayloadSchema.safeParse(payload);
    if (!parsed.success) return;
    if (!(await consumeSocketRateLimit(userId, `channel-${eventName}`, 120, 60_000))) {
      return;
    }
    if (!(await canAccessChannel(userId, parsed.data.channelId))) return;

    socket.to(`channel_${parsed.data.channelId}`).emit(eventName, {
      channelId: parsed.data.channelId,
      userId,
    });
  };

  socket.on("channel_typing", (payload: unknown) =>
    broadcastChannelTyping(payload, "channel_typing"),
  );
  socket.on("channel_stop_typing", (payload: unknown) =>
    broadcastChannelTyping(payload, "channel_stop_typing"),
  );

  socket.on("send_channel_message", async (payload: any, callback: any) => {
    try {
      const parsed = channelMessagePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        callback?.({ error: "Invalid channel-message payload." });
        return;
      }
      if (!(await consumeSocketRateLimit(userId, "channel-message", 40, 60_000))) {
        callback?.({ error: "Message rate limit exceeded" });
        return;
      }
      const textData = parsed.data.text || parsed.data.content;

      const { channelId, attachments, tempId, parentMessageId } = parsed.data;

      const hasText = textData && textData.trim() !== "";
      const hasAttachments =
        Array.isArray(attachments) && attachments.length > 0;

      const channel = await canAccessChannel(userId, channelId);
      if (!channel) {
        callback?.({ error: "Channel access denied" });
        return;
      }

      const message = await prisma.message.create({
        data: {
          content: hasText ? textData.trim() : null,
          channelId,
          senderId: userId,

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

      const signedMessage = {
        ...message,
        attachments: await signAttachments(message.attachments),
      };

      const broadcastPayload = { ...signedMessage, tempId };
      io.to(`channel_${channelId}`).emit(
        "receive_channel_message",
        broadcastPayload,
      );

      if (parentMessageId) {
        const replyCount = await prisma.message.count({
          where: { parentMessageId },
        });
        io.to(`channel_${channelId}`).emit("thread_parent_updated", {
          parentMessageId,
          replyCount,
        });
      }

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
    async (payload: unknown) => {
      try {
        const parsed = channelIdPayloadSchema.safeParse(payload);
        if (!parsed.success) return;
        const { channelId } = parsed.data;
        if (!(await consumeSocketRateLimit(userId, "channel-read", 120, 60_000))) return;
        if (!(await canAccessChannel(userId, channelId))) return;
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

  socket.on("notify_channel_invites", async (payload: unknown) => {
    const parsed = channelIdPayloadSchema.safeParse(payload);
    if (!parsed.success) return;
    const { channelId } = parsed.data;
    if (!(await consumeSocketRateLimit(userId, "channel-invite-notify", 20, 60_000))) return;

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        id: true,
        name: true,
        type: true,
        workspaceId: true,
      },
    });
    if (!channel) return;

    const permission = await authorizeRBAC(userId, channel.workspaceId, "INVITE_USERS");
    if (!permission.allowed) return;

    const members = await prisma.channelMember.findMany({
      where: { channelId },
      select: { userId: true },
    });
    members.forEach(({ userId: targetUserId }) => {
      io.to(targetUserId).emit("added_to_channel", channel);
    });
  });
};
