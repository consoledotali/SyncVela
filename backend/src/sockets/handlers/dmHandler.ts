import { Server, Socket } from "socket.io";
import prisma from "../../config/db";
import {
  deliveryReceiptPayloadSchema,
  directMessagePayloadSchema,
  roomIdPayloadSchema,
  socketIdentifierSchema,
} from "../../validators/socketValidators";
import { signAttachments } from "../../services/storageService";
import { consumeSocketRateLimit } from "../socketSecurity";

const getAuthorizedDirectConversation = async (
  conversationId: string,
  participantId: string,
) =>
  prisma.conversation.findFirst({
    where: {
      id: conversationId,
      isGroup: false,
      participants: { some: { userId: participantId } },
    },
    select: {
      id: true,
      workspaceId: true,
      participants: { select: { userId: true } },
    },
  });

export const registerDMHandlers = (
  io: Server,
  socket: Socket,
  userId: string,
) => {
  socket.on("joinPrivateChat", async (rawPayload: unknown) => {
    try {
      let targetUserId = "";
      let workspaceId: string | null = null;

      if (typeof rawPayload === "string") {
        targetUserId = rawPayload;
      } else if (rawPayload && typeof rawPayload === "object") {
        const obj = rawPayload as Record<string, unknown>;
        if (typeof obj.targetUserId === "string") targetUserId = obj.targetUserId;
        if (typeof obj.workspaceId === "string") workspaceId = obj.workspaceId;
      }

      const target = socketIdentifierSchema.safeParse(targetUserId);
      if (!target.success) return;
      if (!(await consumeSocketRateLimit(userId, "dm-join", 20, 60_000))) return;
      if (target.data === userId) return;

      const targetExists = await prisma.user.findUnique({
        where: { id: target.data },
        select: { id: true },
      });

      if (!targetExists) {
        console.warn(
          `⚠️ [DM Guard] Blocked room join attempt. Target user ${target.data} does not exist.`,
        );
        return;
      }

      if (workspaceId) {
        const [userMembership, targetMembership] = await Promise.all([
          prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId, workspaceId } },
            select: { userId: true },
          }),
          prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId: target.data, workspaceId } },
            select: { userId: true },
          }),
        ]);

        if (!userMembership || !targetMembership) {
          console.warn(
            `⚠️ [DM Guard] Blocked room join. Both users must belong to workspace ${workspaceId}.`,
          );
          return;
        }
      }

      let conversation = await prisma.conversation.findFirst({
        where: {
          isGroup: false,
          workspaceId: workspaceId || null,
          AND: [
            { participants: { some: { userId: userId } } },
            { participants: { some: { userId: target.data } } },
          ],
        },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            isGroup: false,
            workspaceId: workspaceId || null,
            participants: { create: [{ userId }, { userId: target.data }] },
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
      const parsed = directMessagePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        callback?.({ error: "Invalid private-message payload." });
        return;
      }
      if (!(await consumeSocketRateLimit(userId, "dm-message", 40, 60_000))) {
        if (callback) callback({ error: "Too many messages. Please slow down." });
        return;
      }

      const {
        roomId,
        targetUserId,
        text,
        attachments,
        tempId,
        parentMessageId,
      } = parsed.data;
      const textData = text || parsed.data.content;

      const hasText = textData && textData.trim() !== "";
      const hasAttachments =
        Array.isArray(attachments) && attachments.length > 0;

      const targetExists = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true },
      });

      if (!targetExists) {
        console.warn(
          `[DM] Recipient unavailable; removing stale direct-message entry for ${targetUserId}.`,
        );
        socket.emit("dm_recipient_unavailable", {
          userId: targetUserId,
          reason: "recipient_unavailable",
        });
        callback?.({
          error: "Recipient user is no longer available.",
          code: "RECIPIENT_UNAVAILABLE",
        });
        return;
      }

      let conversation:
        | { id: string; workspaceId: string | null; participants: { userId: string }[] }
        | null = null;

      if (roomId) {
        conversation = await getAuthorizedDirectConversation(roomId, userId);
        const targetIsParticipant = conversation?.participants.some(
          (participant) => participant.userId === targetUserId,
        );

        if (!conversation || !targetIsParticipant) {
          if (callback)
            callback({ error: "You are not authorized for this conversation." });
          return;
        }
      } else {
        conversation = await prisma.conversation.findFirst({
          where: {
            isGroup: false,
            workspaceId: parsed.data.workspaceId || null,
            AND: [
              { participants: { some: { userId: userId } } },
              { participants: { some: { userId: targetUserId } } },
            ],
          },
          select: { id: true, workspaceId: true, participants: { select: { userId: true } } },
        });

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              isGroup: false,
              workspaceId: parsed.data.workspaceId || null,
              participants: {
                create: [{ userId: userId }, { userId: targetUserId }],
              },
            },
            select: { id: true, workspaceId: true, participants: { select: { userId: true } } },
          });
        }
      }

      const savedMessage = await prisma.message.create({
        data: {
          content: hasText ? textData.trim() : null,
          senderId: userId,
          conversationId: conversation.id,
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
        ...savedMessage,
        attachments: await signAttachments(savedMessage.attachments),
      };

      const broadcastPayload = {
        ...signedMessage,
        tempId,
        workspaceId: conversation.workspaceId,
      };

      conversation.participants.forEach((participant) => {
        io.to(participant.userId).emit("receiveMessage", broadcastPayload);
      });

      if (tempId) {
        socket.emit("messageSentAck", { tempId, realId: savedMessage.id });
      }

      if (callback) callback({ status: "ok", realId: savedMessage.id, tempId });
    } catch (error) {
      console.error("\n❌❌❌ [DM ENGINE EXCEPTION CAUGHT] ❌❌❌\n", error);
      if (callback)
        callback({
          error: "Internal Server Error. Message delivery failed safely.",
        });
    }
  });

  socket.on(
    "markAsRead",
    async (payload: unknown) => {
      try {
        const parsed = roomIdPayloadSchema.safeParse(payload);
        if (!parsed.success) return;
        const { roomId } = parsed.data;
        if (!(await consumeSocketRateLimit(userId, "dm-read", 120, 60_000))) return;

        const conversation = await getAuthorizedDirectConversation(
          roomId,
          userId,
        );
        if (!conversation) return;

        const serverReadTime = new Date();
        await prisma.participant.update({
          where: {
            userId_conversationId: { userId, conversationId: roomId },
          },
          data: { lastReadAt: serverReadTime },
        });

        conversation.participants
          .filter((participant) => participant.userId !== userId)
          .forEach((participant) => {
            io.to(participant.userId).emit("messagesRead", {
            roomId,
            readAt: serverReadTime.toISOString(),
          });
          });
      } catch (error) {
        console.error("❌ Mark as read failed safely:", error);
      }
    },
  );

  socket.on("markAsDelivered", async (payload: unknown) => {
    const parsed = deliveryReceiptPayloadSchema.safeParse(payload);
    if (!parsed.success) return;
    const { messageId, tempId } = parsed.data;
    if (!(await consumeSocketRateLimit(userId, "dm-delivery", 180, 60_000))) return;

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversation: { participants: { some: { userId } } },
      },
      select: { senderId: true },
    });

    if (message && message.senderId !== userId) {
      io.to(message.senderId).emit("messageDelivered", {
        messageId,
        tempId,
      });
    }
  });

  socket.on("typing", async (payload: unknown) => {
    const parsed = roomIdPayloadSchema.safeParse(payload);
    if (!parsed.success) return;
    const { roomId } = parsed.data;
    if (!(await consumeSocketRateLimit(userId, "dm-typing", 60, 60_000))) return;
    const conversation = await getAuthorizedDirectConversation(roomId, userId);
    conversation?.participants
      .filter((participant) => participant.userId !== userId)
      .forEach((participant) => {
        io.to(participant.userId).emit("userTyping", { senderId: userId });
      });
  });

  socket.on("stopTyping", async (payload: unknown) => {
    const parsed = roomIdPayloadSchema.safeParse(payload);
    if (!parsed.success) return;
    const { roomId } = parsed.data;
    if (!(await consumeSocketRateLimit(userId, "dm-stop-typing", 60, 60_000))) return;
    const conversation = await getAuthorizedDirectConversation(roomId, userId);
    conversation?.participants
      .filter((participant) => participant.userId !== userId)
      .forEach((participant) => {
        io.to(participant.userId).emit("userStoppedTyping", {
          senderId: userId,
        });
      });
  });
};
