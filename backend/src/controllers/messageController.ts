import { Response } from "express";
import prisma from "../config/db";
import { AuthenticatedRequest } from "./channelController";
import { signMessageAttachments, signAttachments } from "../utils/s3";

const reactionInclude = { select: { emoji: true, userId: true } } as const;

// PUBLIC channels are workspace-visible; PRIVATE channels additionally need an invite.
const canAccessChannel = async (userId: string, channelId: string): Promise<boolean> => {
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
  if (channel.type !== "PRIVATE") return true;

  return !!(await prisma.channelMember.findUnique({
    where: { userId_channelId: { userId, channelId } },
    select: { userId: true },
  }));
};

const isConversationParticipant = async (userId: string, conversationId: string): Promise<boolean> =>
  !!(await prisma.participant.findUnique({
    where: { userId_conversationId: { userId, conversationId } },
    select: { userId: true },
  }));

export const getChannelMessages = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const userId = req.user!.userId;
    const cursor = req.query.cursor as string | undefined;
    const limit = 50;

    if (!(await canAccessChannel(userId, channelId))) {
      res.status(403).json({ error: "You don't have access to this channel." });
      return;
    }

    const messages = await prisma.message.findMany({
      where: { channelId, parentMessageId: null },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true, isDeleted: true } },
        attachments: true,
        reactions: reactionInclude,
        _count: { select: { replies: true } },
      },
    });

    const hasMore = messages.length === limit;
    const nextCursor = hasMore ? messages[messages.length - 1].id : null;
    res.status(200).json({
      messages: await signMessageAttachments(messages.reverse()),
      hasMore,
      nextCursor,
    });
  } catch (error) {
    console.error("❌ [BACKEND] Fetching Channel History Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getDirectMessages = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const conversationId = req.params.roomId as string;
    const userId = req.user!.userId;
    const cursor = req.query.cursor as string | undefined;
    const limit = 50;

    if (!(await isConversationParticipant(userId, conversationId))) {
      res.status(403).json({ error: "You don't have access to this conversation." });
      return;
    }

    const messages = await prisma.message.findMany({
      where: { conversationId, parentMessageId: null },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true, isDeleted: true } },
        attachments: true,
        reactions: reactionInclude,
        _count: { select: { replies: true } },
      },
    });
    const participants = await prisma.participant.findMany({
      where: { conversationId },
      select: { userId: true, lastReadAt: true },
    });
    const hasMore = messages.length === limit;
    const nextCursor = hasMore ? messages[messages.length - 1].id : null;

    res.status(200).json({
      messages: await signMessageAttachments(messages.reverse()),
      hasMore,
      nextCursor,
      participants,
    });
  } catch (error) {
    console.error("❌ [BACKEND] Fetching DM History Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const searchMessages = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const channelId = typeof req.query.channelId === "string" ? req.query.channelId : undefined;
    const conversationId = typeof req.query.conversationId === "string" ? req.query.conversationId : undefined;
    const limit = 30;

    if (query.length < 2 || query.length > 200 || (!channelId && !conversationId) || (channelId && conversationId)) {
      res.status(400).json({ error: "A search query of 2-200 characters and exactly one conversation scope is required." });
      return;
    }

    const userId = req.user!.userId;
    if (channelId ? !(await canAccessChannel(userId, channelId)) : !(await isConversationParticipant(userId, conversationId!))) {
      res.status(403).json({ error: "You don't have access to this conversation." });
      return;
    }

    const messages = await prisma.message.findMany({
      where: {
        ...(channelId ? { channelId } : { conversationId }),
        parentMessageId: null,
        content: { contains: query, mode: "insensitive" },
      },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true, isDeleted: true } },
        attachments: true,
        reactions: reactionInclude,
        _count: { select: { replies: true } },
      },
    });

    const hasMore = messages.length === limit;
    const nextCursor = hasMore ? messages[messages.length - 1].id : null;
    res.status(200).json({
      messages: await signMessageAttachments(messages.reverse()),
      hasMore,
      nextCursor,
    });
  } catch (error) {
    console.error("❌ [BACKEND] Message search failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getThreadMessages = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const parentId = req.params.parentId as string;
    const parentMessage = await prisma.message.findUnique({
      where: { id: parentId },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true, isDeleted: true } },
        attachments: true,
        reactions: reactionInclude,
        _count: { select: { replies: true } },
      },
    });

    if (!parentMessage) {
      res.status(404).json({ error: "Original message not found." });
      return;
    }

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

    const replies = await prisma.message.findMany({
      where: { parentMessageId: parentId },
      orderBy: { createdAt: "asc" },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true, isDeleted: true } },
        attachments: true,
        reactions: reactionInclude,
      },
    });
    const signedParent = {
      ...parentMessage,
      attachments: await signAttachments(parentMessage.attachments),
    };

    res.status(200).json({
      parentMessage: signedParent,
      replies: await signMessageAttachments(replies),
    });
  } catch (error) {
    console.error("❌ [BACKEND] Fetching Thread Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
