import { Response } from "express";
import prisma from "../config/db";
import { AuthenticatedRequest } from "./channelController"; // 🛡️ Strict TS Type

export const getUsersForSidebar = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    // 🛡️ SECURITY FIX 1: Frontend ki query par thooko. Token se ID nikalo.
    const userId = req.user!.userId;

    // 1. Active Chats: Wo saari 1-on-1 chats jisme current user hai
    const activeConversations = await prisma.conversation.findMany({
      where: {
        isGroup: false,
        participants: {
          some: { userId: userId },
        },
      },
      orderBy: {
        lastMessageAt: "desc",
      },
      include: {
        participants: {
          where: { userId: { not: userId } },
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

    // 2. Extract and Filter Active Users
    const activeUsers = activeConversations
      .filter(
        (c) =>
          c.participants.length > 0 &&
          c.participants[0].user.isEmailVerified === true,
      )
      .map((c) => c.participants[0].user);

    const activeUserIds = activeUsers.map((u) => u.id);

    // 🛡️ SECURITY FIX 2: Tenant Isolation (Cross-Workspace Data Leak Prevented)
    // Pehle pata karo ke yeh user kin workspaces ka hissa hai
    const myWorkspaces = await prisma.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true },
    });

    const myWorkspaceIds = myWorkspaces.map((w) => w.workspaceId);

    // 3. Other Users (Isolated): Sirf un logon ko lao jo mere kisi workspace mein mojood hain
    const otherUsers = await prisma.user.findMany({
      where: {
        isEmailVerified: true,
        id: {
          notIn: [userId, ...activeUserIds], // Khud ko aur active chat walon ko exclude karo
        },
        workspaces: {
          some: {
            workspaceId: { in: myWorkspaceIds }, // 🔒 TENANT LOCK: Sirf shared workspace wale allowed hain
          },
        },
      },
      select: { id: true, name: true, email: true, avatarUrl: true },
      orderBy: { name: "asc" },
    });

    // 4. Combine and send
    const sortedUsersList = [...activeUsers, ...otherUsers];

    res.status(200).json(sortedUsersList);
  } catch (error) {
    console.error("❌ Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};
