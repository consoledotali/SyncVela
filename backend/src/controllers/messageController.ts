import { Response } from "express";
import prisma from "../config/db";
import { AuthenticatedRequest } from "./channelController"; // Utilizing your strict types

// 1. GET CHANNEL MESSAGES (With Secure Cursor Pagination)
export const getChannelMessages = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const cursor = req.query.cursor as string | undefined;
    const LIMIT = 50; // Standard enterprise viewport size

    const messages = await prisma.message.findMany({
      where: { channelId },
      take: LIMIT,
      skip: cursor ? 1 : 0, // Skip the anchor point itself if cursor exists
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: "desc" }, // Fetch latest to oldest for cursor scanning
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    const hasMore = messages.length === LIMIT;
    // Next cursor will be the ID of the oldest message in this current batch
    const nextCursor = hasMore ? messages[messages.length - 1].id : null;

    res.status(200).json({
      messages: messages.reverse(), // Reverse back for natural chronological UI reading
      hasMore,
      nextCursor,
    });
  } catch (error) {
    console.error("❌ [BACKEND] Fetching Channel History Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 2. GET DIRECT MESSAGES (With Secure Cursor Pagination)
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
        sender: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    const hasMore = messages.length === LIMIT;
    const nextCursor = hasMore ? messages[messages.length - 1].id : null;

    res.status(200).json({
      messages: messages.reverse(),
      hasMore,
      nextCursor,
    });
  } catch (error) {
    console.error("❌ [BACKEND] Fetching DM History Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
