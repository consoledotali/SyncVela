import { Response } from "express";
import prisma from "../config/db";
import { AuthenticatedRequest } from "./channelController"; // 🛡️ Strict Types

// 1. GET CHANNEL MESSAGES (Slack Style)
export const getChannelMessages = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;

    const messages = await prisma.message.findMany({
      where: { channelId },
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    res.status(200).json(messages.reverse());
  } catch (error) {
    console.error("❌ Fetching Channel Messages Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 2. GET DIRECT MESSAGES (Unified DM Style)
export const getDirectMessages = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const conversationId = req.params.roomId as string;

    const messages = await prisma.message.findMany({
      where: { conversationId },
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    res.status(200).json({
      messages: messages.reverse(),
      hasMore: messages.length === 50,
      nextCursor: messages.length > 0 ? messages[0].id : null,
    });
  } catch (error) {
    console.error("❌ Fetching Direct Messages Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
