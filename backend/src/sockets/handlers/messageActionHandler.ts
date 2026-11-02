import { Server, Socket } from "socket.io";
import prisma from "../../config/db";
import {
  deleteMessagePayloadSchema,
  editMessagePayloadSchema,
  reactionPayloadSchema,
} from "../../features/chat/validation/socketSchemas";
import {
  canAccessChannel,
  consumeSocketRateLimit,
} from "../socketSecurity";

const reactionSelect = { select: { emoji: true, userId: true } } as const;

const canReactToMessage = async (userId: string, messageId: string) => {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, channelId: true, conversationId: true },
  });
  if (!message) return null;

  if (message.channelId) {
    return (await canAccessChannel(userId, message.channelId)) ? message : null;
  }

  if (!message.conversationId) return null;
  const participant = await prisma.participant.findUnique({
    where: {
      userId_conversationId: {
        userId,
        conversationId: message.conversationId,
      },
    },
    select: { userId: true },
  });
  return participant ? message : null;
};

const broadcastMessageUpdate = async (
  io: Server,
  event: "message_deleted" | "message_edited" | "thread_parent_updated",
  message: { channelId: string | null; conversationId: string | null },
  payload: Record<string, unknown>,
) => {
  if (message.channelId) {
    io.to(`channel_${message.channelId}`).emit(event, payload);
    return;
  }
  if (!message.conversationId) return;

  const participants = await prisma.participant.findMany({
    where: { conversationId: message.conversationId },
    select: { userId: true },
  });
  participants.forEach(({ userId: participantId }) =>
    io.to(participantId).emit(event, payload),
  );
};

export const registerMessageActionHandlers = (
  io: Server,
  socket: Socket,
  userId: string,
) => {
  socket.on(
    "toggle_reaction",
    async (
      payload: { messageId?: string; emoji?: string },
      callback?: (result: { ok?: true; error?: string; reactions?: Array<{ emoji: string; userId: string }> }) => void,
    ) => {
      try {
        const parsed = reactionPayloadSchema.safeParse(payload);
        if (!parsed.success) {
          callback?.({ error: "A valid message and reaction are required." });
          return;
        }
        const { messageId, emoji } = parsed.data;

        if (!(await consumeSocketRateLimit(userId, "message-reaction", 40, 60_000))) {
          callback?.({ error: "Too many reaction requests. Please retry shortly." });
          return;
        }

        const message = await canReactToMessage(userId, messageId);
        if (!message) {
          callback?.({ error: "You do not have access to this message." });
          return;
        }

        const existing = await prisma.messageReaction.findUnique({
          where: { messageId_userId_emoji: { messageId, userId, emoji } },
          select: { id: true },
        });

        if (existing) {
          await prisma.messageReaction.delete({ where: { id: existing.id } });
        } else {
          await prisma.messageReaction.create({ data: { messageId, userId, emoji } });
        }

        const reactions = await prisma.messageReaction.findMany({
          where: { messageId },
          ...reactionSelect,
        });
        const update = { messageId, reactions };

        if (message.channelId) {
          io.to(`channel_${message.channelId}`).emit("message_reactions_updated", update);
        } else if (message.conversationId) {
          const participants = await prisma.participant.findMany({
            where: { conversationId: message.conversationId },
            select: { userId: true },
          });
          participants.forEach(({ userId: participantId }) =>
            io.to(participantId).emit("message_reactions_updated", update),
          );
        }

        callback?.({ ok: true, reactions });
      } catch (error) {
        console.error("❌ Reaction update failed:", error);
        callback?.({ error: "Unable to update this reaction." });
      }
    },
  );

  // 🔴 DELETION ENGINE (WITH GOD MODE)
  socket.on("delete_message", async (payload: any, callback: any) => {
    try {
      const parsed = deleteMessagePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        callback?.({ error: "A valid message is required." });
        return;
      }
      const { messageId } = parsed.data;
      if (!(await consumeSocketRateLimit(userId, "delete-message", 20, 60_000))) {
        callback?.({ error: "Too many delete requests. Please retry shortly." });
        return;
      }

      const existingMessage = await prisma.message.findUnique({
        where: { id: messageId },
      });
      if (!existingMessage) {
        if (callback) callback({ error: "Message not found" });
        return;
      }

      if (!(await canReactToMessage(userId, messageId))) {
        callback?.({ error: "Unauthorized: You don't have access to this message." });
        return;
      }

      // 🚀 THE GOD MODE GATEKEEPER
      let isAuthorized = existingMessage.senderId === userId;

      // Server derives moderation scope from the persisted message, never payload.roomId.
      if (!isAuthorized && existingMessage.channelId) {
        const channel = await prisma.channel.findUnique({
          where: { id: existingMessage.channelId },
          select: { workspaceId: true },
        });

        if (channel) {
          const member = await prisma.workspaceMember.findUnique({
            where: {
              userId_workspaceId: { userId, workspaceId: channel.workspaceId },
            },
            select: { role: true },
          });

          if (member && (member.role === "OWNER" || member.role === "ADMIN")) {
            isAuthorized = true; // God Mode Activated
          }
        }
      }

      if (!isAuthorized) {
        if (callback)
          callback({
            error:
              "Unauthorized: You don't have permission to moderate this message.",
          });
        return;
      }

      await prisma.message.delete({ where: { id: messageId } });

      const broadcastData = {
        messageId,
        roomId: existingMessage.channelId || existingMessage.conversationId,
        isChannel: !!existingMessage.channelId,
        senderId: existingMessage.senderId, // 🛡️ STRICT FIX: Notify using original sender's ID so unread badges sync correctly
        parentMessageId: existingMessage.parentMessageId, // 🚀 THREAD COUNT FIX: Client uses this to decrement parent's reply badge
      };

      await broadcastMessageUpdate(io, "message_deleted", existingMessage, broadcastData);

      if (existingMessage.parentMessageId) {
        const replyCount = await prisma.message.count({
          where: { parentMessageId: existingMessage.parentMessageId },
        });
        await broadcastMessageUpdate(io, "thread_parent_updated", existingMessage, {
          parentMessageId: existingMessage.parentMessageId,
          replyCount,
        });
      }

      if (callback) callback({ status: "ok" });
    } catch (error) {
      console.error("❌ Delete Error:", error);
      if (callback) callback({ error: "Failed to delete" });
    }
  });

  // 🟠 EDIT ENGINE (STRICTLY 'isMe' ONLY - No God Mode for editing)
  socket.on("edit_message", async (payload: any, callback: any) => {
    try {
      const parsed = editMessagePayloadSchema.safeParse(payload);
      if (!parsed.success) {
        callback?.({ error: "A valid message and non-empty content are required." });
        return;
      }
      const { messageId, newText } = parsed.data;
      if (!(await consumeSocketRateLimit(userId, "edit-message", 30, 60_000))) {
        callback?.({ error: "Too many edit requests. Please retry shortly." });
        return;
      }

      const existingMessage = await prisma.message.findUnique({
        where: { id: messageId },
      });

      if (!existingMessage) {
        if (callback) callback({ error: "Message not found" });
        return;
      }

      if (!(await canReactToMessage(userId, messageId))) {
        callback?.({ error: "Unauthorized: You don't have access to this message." });
        return;
      }

      // 🛡️ Edit hamesha sirf sender kar sakta hai
      if (existingMessage.senderId !== userId) {
        if (callback) callback({ error: "Unauthorized" });
        return;
      }

      await prisma.message.update({
        where: { id: messageId },
        data: { content: newText.trim() },
      });

      const broadcastData = {
        messageId,
        newText: newText.trim(),
        roomId: existingMessage.channelId || existingMessage.conversationId,
      };
      await broadcastMessageUpdate(io, "message_edited", existingMessage, broadcastData);

      if (callback) callback({ status: "ok" });
    } catch (error) {
      console.error("❌ Edit Error:", error);
      if (callback) callback({ error: "Failed to edit" });
    }
  });
};
