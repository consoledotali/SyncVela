import { Response } from "express";
import prisma from "../config/db";
import { AuthenticatedRequest } from "./channelController";

// 1. GET CHANNEL MESSAGES
export const getChannelMessages = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const cursor = req.query.cursor as string | undefined;
    const LIMIT = 50;

    const messages = await prisma.message.findMany({
      where: { channelId },
      take: LIMIT,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        attachments: true, // 🚀 STRICT EXTRACTION
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

// 2. GET DIRECT MESSAGES
export const getDirectMessages = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const conversationId = req.params.roomId as string;
    const cursor = req.query.cursor as string | undefined;
    const LIMIT = 50;

    const messages = await prisma.message.findMany({
      where: { conversationId },
      take: LIMIT,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        attachments: true, // 🚀 STRICT EXTRACTION
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