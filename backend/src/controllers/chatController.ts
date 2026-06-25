import { Response } from "express";
import prisma from "../config/db";
import { AuthenticatedRequest } from "./channelController"; // 🛡️ Strict Type import karo

export const getPrivateMessages = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const roomId = req.params.roomId as string;
    const cursor = req.query.cursor as string | undefined;

    // 🛡️ SECURITY FIX 1: Apne gatekeeper wale token se ID nikalo
    const userId = req.user!.userId;
    const limit = 30;

    if (!roomId) {
      res.status(400).json({ error: "Room ID is required" });
      return;
    }

    // 🛡️ SECURITY FIX 2: Confirm karo ke yeh user waqai is private room ka hissa hai ya kisi aur ka room id daal kar dekh raha hai!
    const isParticipant = await prisma.participant.findUnique({
      where: {
        userId_conversationId: { userId, conversationId: roomId },
      },
    });

    if (!isParticipant) {
      res.status(403).json({
        error: "Access Denied: You are not a participant of this chat.",
      });
      return;
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: roomId },
      take: limit,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
      orderBy: { createdAt: "desc" },
    });

    const sortedMessages = messages.reverse();

    const participants = await prisma.participant.findMany({
      where: { conversationId: roomId },
      select: { userId: true, lastReadAt: true },
    });

    const hasMore = messages.length === limit;

    res.status(200).json({
      messages: sortedMessages,
      participants,
      hasMore,
      nextCursor: sortedMessages.length > 0 ? sortedMessages[0].id : null,
    });
  } catch (error) {
    console.error("❌ Error fetching private messages:", error);
    res.status(500).json({ error: "Failed to fetch chat history" });
  }
};

export const getUnreadCounts = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    // 🛡️ SECURITY FIX 3: Frontend ki Query par kabhi trust mat karo. Token is the single source of truth.
    const userId = req.user!.userId;

    const userParticipants = await prisma.participant.findMany({
      where: { userId: userId },
      select: { conversationId: true, lastReadAt: true },
    });

    const counts: Record<string, number> = {};

    // 🚀 PERFORMANCE FIX: Array.map aur Promise.all use karke parallel DB queries bhejo, synchronous for-loop nahi.
    await Promise.all(
      userParticipants.map(async (p) => {
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: p.conversationId,
            senderId: { not: userId },
            ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
          },
        });

        if (unreadCount > 0) {
          const otherParticipant = await prisma.participant.findFirst({
            where: {
              conversationId: p.conversationId,
              userId: { not: userId },
            },
            select: { userId: true },
          });

          if (otherParticipant) {
            counts[otherParticipant.userId] = unreadCount;
          }
        }
      }),
    );

    res.status(200).json(counts);
  } catch (error) {
    console.error("❌ Error fetching unread counts:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
