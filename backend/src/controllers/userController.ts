import { Response } from "express";
import prisma from "../config/db";
import { AuthenticatedRequest } from "./channelController";

export const getUsersForSidebar = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    // 1. Fetch Active Conversations WITH current user's participant state
    const activeConversations = await prisma.conversation.findMany({
      where: {
        isGroup: false,
        participants: { some: { userId: userId } },
      },
      orderBy: { lastMessageAt: "desc" },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                isEmailVerified: true,
              },
            },
          },
        },
      },
    });

    // 2. 🛡️ HYDRATION ENGINE: Extract Users AND Calculate Exact Unread Counts
    const activeUsersWithMeta = await Promise.all(
      activeConversations.map(async (c) => {
        const targetParticipant = c.participants.find(
          (p) => p.userId !== userId,
        );
        const myParticipant = c.participants.find((p) => p.userId === userId);

        if (!targetParticipant || !targetParticipant.user.isEmailVerified)
          return null;

        const unreadCount = await prisma.message.count({
          where: {
            conversationId: c.id,
            createdAt: { gt: myParticipant?.lastReadAt || new Date(0) },
            senderId: { not: userId },
          },
        });

        return {
          ...targetParticipant.user,
          roomId: c.id,
          unreadCount,
          isActiveChat: true,
        };
      }),
    );

    const validActiveUsers = activeUsersWithMeta.filter(Boolean);
    const activeUserIds = validActiveUsers.map((u) => u!.id);

    // 3. Tenant Isolation
    const myWorkspaces = await prisma.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true },
    });
    const myWorkspaceIds = myWorkspaces.map((w) => w.workspaceId);

    // 4. Other Users (No active chat yet)
    const otherUsers = await prisma.user.findMany({
      where: {
        isEmailVerified: true,
        id: { notIn: [userId, ...activeUserIds] },
        workspaces: { some: { workspaceId: { in: myWorkspaceIds } } },
      },
      select: { id: true, name: true, email: true, avatarUrl: true },
      orderBy: { name: "asc" },
    });

    const formattedOtherUsers = otherUsers.map((u) => ({
      ...u,
      roomId: null,
      unreadCount: 0,
      isActiveChat: false,
    }));

    // 5. Combine and Send
    res.status(200).json([...validActiveUsers, ...formattedOtherUsers]);
  } catch (error) {
    console.error("❌ Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

// 🚀 THE AVATAR UPDATE ENGINE
export const updateAvatar = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { avatarUrl } = req.body;

    if (!avatarUrl) {
      res.status(400).json({ error: "Avatar URL is strictly required." });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });

    const io = req.app.get("socketio");
    if (io) {
      io.emit("user_avatar_updated", {
        userId: updatedUser.id,
        avatarUrl: updatedUser.avatarUrl,
      });
    }

    res
      .status(200)
      .json({ message: "Avatar synced successfully", user: updatedUser });
  } catch (error) {
    console.error("❌ Avatar Update Database Failure:", error);
    res.status(500).json({ error: "Failed to process avatar update." });
  }
};
