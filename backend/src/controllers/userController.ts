import { Request, Response } from "express";
import prisma from "../config/db";

export const getUsersForSidebar = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { currentUserId } = req.query;

    if (!currentUserId || typeof currentUserId !== "string") {
      res.status(400).json({ error: "Valid Current User ID is required" });
      return;
    }

    // 1. Active Chats Nikalo: Wo saari 1-on-1 chats nikalo jisme main hun
    const activeConversations = await prisma.conversation.findMany({
      where: {
        isGroup: false,
        participants: {
          some: { userId: currentUserId },
        },
      },
      orderBy: {
        lastMessageAt: "desc",
      },
      include: {
        participants: {
          where: { userId: { not: currentUserId } },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                isEmailVerified: true,
              }, // Verified status bhi mangwa liya check ke liye
            },
          },
        },
      },
    });

    // 2. User list extract karo (Aur strictly sirf verified users filter out karo)
    const activeUsers = activeConversations
      .filter(
        (c) =>
          c.participants.length > 0 &&
          c.participants[0].user.isEmailVerified === true,
      ) // 🛡️ THE GUARD: Active list mein bhi check
      .map((c) => c.participants[0].user);

    const activeUserIds = activeUsers.map((u) => u.id);

    // 3. Other Users Nikalo: THE ROOT CAUSE OF YOUR BUG WAS HERE
    const otherUsers = await prisma.user.findMany({
      where: {
        isEmailVerified: true, // 🛡️ THE FIX: Sirf verified log aayenge, OTP wale kachre mein rahenge
        id: {
          notIn: [currentUserId, ...activeUserIds],
        },
      },
      select: { id: true, name: true, email: true, avatarUrl: true },
      orderBy: { name: "asc" },
    });

    // 4. Combine karo aur bhej do
    const sortedUsersList = [...activeUsers, ...otherUsers];

    res.status(200).json(sortedUsersList);
  } catch (error) {
    console.error("❌ Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};
