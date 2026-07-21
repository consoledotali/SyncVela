import { Response } from "express";
import prisma from "../config/db";
import { AuthenticatedRequest } from "./channelController";
import { signMessageAttachments, signAttachments } from "../utils/s3";

// 🛡️ AUTH HELPERS
// Channel access: PUBLIC channel ke liye workspace-member hona kaafi hai,
// PRIVATE channel ke liye ChannelMember record chahiye.
const canAccessChannel = async (
  userId: string,
  channelId: string,
): Promise<boolean> => {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { workspaceId: true, type: true },
  });
  if (!channel) return false;

  const workspaceMember = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: channel.workspaceId } },
    select: { userId: true },
  });
  if (!workspaceMember) return false;

  if (channel.type === "PRIVATE") {
    const channelMember = await prisma.channelMember.findUnique({
      where: { userId_channelId: { userId, channelId } },
      select: { userId: true },
    });
    return !!channelMember;
  }

  return true;
};

// Conversation (DM) access: user us conversation ka participant hona chahiye.
const isConversationParticipant = async (
  userId: string,
  conversationId: string,
): Promise<boolean> => {
  const participant = await prisma.participant.findUnique({
    where: { userId_conversationId: { userId, conversationId } },
    select: { userId: true },
  });
  return !!participant;
};

// 1. GET CHANNEL MESSAGES (MAIN CHAT ONLY)
export const getChannelMessages = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const userId = req.user!.userId;
    const cursor = req.query.cursor as string | undefined;
    const LIMIT = 50;

    // 🛡️ AUTHORIZATION: User ko is channel ka access hona chahiye
    const authorized = await canAccessChannel(userId, channelId);
    if (!authorized) {
      res.status(403).json({ error: "You don't have access to this channel." });
      return;
    }

    const messages = await prisma.message.findMany({
      // 🚀 SHIELD: Sirf main messages lao, replies ko main chat se block karo
      where: { channelId, parentMessageId: null },
      take: LIMIT,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        attachments: true,
        // 🚀 ENTERPRISE FEATURE: Count total replies so frontend can show "4 replies" button
        _count: { select: { replies: true } },
      },
    });

    const hasMore = messages.length === LIMIT;
    const nextCursor = hasMore ? messages[messages.length - 1].id : null;

    const signed = await signMessageAttachments(messages.reverse());

    res.status(200).json({ messages: signed, hasMore, nextCursor });
  } catch (error) {
    console.error("❌ [BACKEND] Fetching Channel History Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 2. GET DIRECT MESSAGES (MAIN CHAT ONLY)
export const getDirectMessages = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const conversationId = req.params.roomId as string;
    const userId = req.user!.userId;
    const cursor = req.query.cursor as string | undefined;
    const LIMIT = 50;

    // 🛡️ AUTHORIZATION: User is conversation ka participant hona chahiye
    const authorized = await isConversationParticipant(userId, conversationId);
    if (!authorized) {
      res
        .status(403)
        .json({ error: "You don't have access to this conversation." });
      return;
    }

    const messages = await prisma.message.findMany({
      // 🚀 SHIELD: Main chat mein sirf root messages bhejo
      where: { conversationId, parentMessageId: null },
      take: LIMIT,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        attachments: true,
        _count: { select: { replies: true } },
      },
    });

    const participants = await prisma.participant.findMany({
      where: { conversationId },
      select: { userId: true, lastReadAt: true },
    });

    const hasMore = messages.length === LIMIT;
    const nextCursor = hasMore ? messages[messages.length - 1].id : null;

    const signed = await signMessageAttachments(messages.reverse());

    res.status(200).json({
      messages: signed,
      hasMore,
      nextCursor,
      participants,
    });
  } catch (error) {
    console.error("❌ [BACKEND] Fetching DM History Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 3. 🚀 NEW: GET THREAD MESSAGES (Parent + Replies)
export const getThreadMessages = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const parentId = req.params.parentId as string;

    // Pehle root message lao
    const parentMessage = await prisma.message.findUnique({
      where: { id: parentId },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        attachments: true,
        _count: { select: { replies: true } },
      },
    });

    if (!parentMessage) {
      res.status(404).json({ error: "Original message not found." });
      return;
    }

    // 🛡️ AUTHORIZATION: Thread ke root message ke channel/conversation ka access check karo
    const userId = req.user!.userId;
    const authorized = parentMessage.channelId
      ? await canAccessChannel(userId, parentMessage.channelId)
      : parentMessage.conversationId
        ? await isConversationParticipant(userId, parentMessage.conversationId)
        : false;

    if (!authorized) {
      res.status(403).json({ error: "You don't have access to this thread." });
      return;
    }

    // Ab uske saare replies lao (Oldest first for chronological reading)
    const replies = await prisma.message.findMany({
      where: { parentMessageId: parentId },
      orderBy: { createdAt: "asc" },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        attachments: true,
      },
    });

    const signedParent = {
      ...parentMessage,
      attachments: await signAttachments(parentMessage.attachments),
    };
    const signedReplies = await signMessageAttachments(replies);

    res
      .status(200)
      .json({ parentMessage: signedParent, replies: signedReplies });
  } catch (error) {
    console.error("❌ [BACKEND] Fetching Thread Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
