import { Response } from "express";
import prisma from "../config/db";
import { AuthenticatedRequest } from "./channelController";

export const getUnreadCounts = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.userId; // 🛡️ Single Source of Truth

    const userParticipants = await prisma.participant.findMany({
      where: { userId: userId },
      select: { conversationId: true, lastReadAt: true },
    });

    const counts: Record<string, number> = {};

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
