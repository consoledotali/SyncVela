import prisma from "../config/dbConfig";
import type { Request, Response } from "express";
import { AuthenticatedRequest } from "../types/authTypes";
import { createAvatarDownloadUrl } from "../services/storageService";

const isValidAvatarKey = (fileKey: unknown): fileKey is string =>
  typeof fileKey === "string" &&
  /^avatars\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_./-]+$/.test(fileKey);

const buildAvatarProxyUrl = (req: Request, fileKey: string): string => {
  const configuredBaseUrl = process.env.API_PUBLIC_URL?.replace(/\/+$/, "");
  const requestBaseUrl = `${req.protocol}://${req.get("host")}`;
  const apiBaseUrl = configuredBaseUrl || requestBaseUrl;
  return `${apiBaseUrl}/api/users/avatar-object?key=${encodeURIComponent(fileKey)}`;
};

export const getUsersForSidebar = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const workspaceId = req.query.workspaceId as string | undefined;

    if (!workspaceId) {
      res.status(200).json([]);
      return;
    }

    const isMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!isMember) {
      res.status(403).json({ error: "Access denied to workspace" });
      return;
    }

    const activeConversations = await prisma.conversation.findMany({
      where: {
        workspaceId,
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
                isDeleted: true,
              },
            },
          },
        },
      },
    });

    const activeUsersWithMeta = await Promise.all(
      activeConversations.map(async (c) => {
        const targetParticipant = c.participants.find(
          (p) => p.userId !== userId,
        );
        const myParticipant = c.participants.find((p) => p.userId === userId);

        if (!targetParticipant || (!targetParticipant.user.isEmailVerified && !targetParticipant.user.isDeleted))
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
          name: targetParticipant.user.isDeleted ? "Deleted User" : targetParticipant.user.name,
          email: targetParticipant.user.isDeleted ? "" : targetParticipant.user.email,
          avatarUrl: targetParticipant.user.isDeleted ? null : targetParticipant.user.avatarUrl,

          roomId: c.id,
          unreadCount,
          isActiveChat: true,
        };
      }),
    );

    const validActiveUsers = activeUsersWithMeta.filter(
      (user): user is NonNullable<typeof user> =>
        user !== null && user.id !== userId,
    );
    const activeUsersById = new Map(
      validActiveUsers.map((user) => [user.id, user]),
    );
    const uniqueActiveUsers = [...activeUsersById.values()];
    const activeUserIds = uniqueActiveUsers.map((user) => user.id);

    const otherUsers = await prisma.user.findMany({
      where: {
        isEmailVerified: true,
        id: { notIn: [userId, ...activeUserIds] },
        workspaces: { some: { workspaceId } },
      },
            select: { id: true, name: true, email: true, avatarUrl: true, isDeleted: true },

      orderBy: { name: "asc" },
    });

        const formattedOtherUsers = otherUsers.filter((u) => !u.isDeleted).map((u) => ({
      ...u,

      roomId: null,
      unreadCount: 0,
      isActiveChat: false,
    }));

    res.status(200).json([...uniqueActiveUsers, ...formattedOtherUsers]);
  } catch (error) {
    console.error("❌ Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

export const updateAvatar = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { fileKey } = req.body;
    const avatarPrefix = `avatars/${userId}/`;

    if (!isValidAvatarKey(fileKey) || !fileKey.startsWith(avatarPrefix)) {
      res.status(400).json({ error: "A server-generated avatar key is required." });
      return;
    }

    const avatarUrl = buildAvatarProxyUrl(req, fileKey);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        provider: true,
        password: true,
      },
    });

    const safeUpdatedUser = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      avatarUrl: updatedUser.avatarUrl,
      provider: updatedUser.provider,
      hasPassword: Boolean(updatedUser.password),
    };

    const io = req.app.get("socketio");
    if (io) {
      io.emit("user_avatar_updated", {
        userId: safeUpdatedUser.id,
        avatarUrl: safeUpdatedUser.avatarUrl,
      });
    }

    res
      .status(200)
      .json({ message: "Avatar synced successfully", user: safeUpdatedUser });
  } catch (error) {
    console.error("❌ Avatar Update Database Failure:", error);
    res.status(500).json({ error: "Failed to process avatar update." });
  }
};

export const serveAvatarObject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const fileKey = req.query.key;
  if (!isValidAvatarKey(fileKey)) {
    res.status(400).json({ error: "A valid avatar object key is required." });
    return;
  }

  try {
    const signedUrl = await createAvatarDownloadUrl(fileKey);
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=300");
    res.redirect(307, signedUrl);
  } catch (error) {
    console.error("Unable to serve avatar object:", error);
    res.status(404).json({ error: "Avatar is unavailable." });
  }
};
