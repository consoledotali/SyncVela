import { Response } from "express";
import prisma from "../config/db";
import { AuthenticatedRequest } from "./channelController";

// 1. GET CHANNEL MESSAGES (MAIN CHAT ONLY)
export const getChannelMessages = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const cursor = req.query.cursor as string | undefined;
    const LIMIT = 50;

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

    res.status(200).json({ messages: messages.reverse(), hasMore, nextCursor });
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
    const cursor = req.query.cursor as string | undefined;
    const LIMIT = 50;

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

    res.status(200).json({
      messages: messages.reverse(),
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

    // Ab uske saare replies lao (Oldest first for chronological reading)
    const replies = await prisma.message.findMany({
      where: { parentMessageId: parentId },
      orderBy: { createdAt: "asc" },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        attachments: true,
      },
    });

    res.status(200).json({ parentMessage, replies });
  } catch (error) {
    console.error("❌ [BACKEND] Fetching Thread Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
