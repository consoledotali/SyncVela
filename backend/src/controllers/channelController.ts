import { Request, Response } from "express";
import prisma from "../config/db";

export interface AuthenticatedRequest extends Request {
  user?: { userId: string };
}

// 1. CREATE NEW CHANNEL
export const createChannel = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { name, type, workspaceId } = req.body;
    const userId = req.user!.userId;

    if (!name || !workspaceId) {
      res
        .status(400)
        .json({ error: "Channel name and Workspace ID are required." });
      return;
    }

    const isWorkspaceMember = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });

    if (!isWorkspaceMember) {
      res.status(403).json({ error: "Access Denied." });
      return;
    }

    if (
      isWorkspaceMember.role === "MEMBER" ||
      isWorkspaceMember.role === "GUEST"
    ) {
      res.status(403).json({ error: "Unauthorized." });
      return;
    }

    const channel = await prisma.$transaction(async (tx) => {
      const newChannel = await tx.channel.create({
        data: {
          name: name.toLowerCase().trim().replace(/\s+/g, "-"),
          type,
          workspaceId,
        },
      });

      await tx.channelMember.create({
        data: { channelId: newChannel.id, userId },
      });

      return newChannel;
    });

    res.status(201).json(channel);
  } catch (error) {
    console.error("❌ Channel Creation Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 2. GET ALL CHANNELS IN A WORKSPACE
export const getWorkspaceChannels = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const userId = req.user!.userId;

    const isWorkspaceMember = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });

    if (!isWorkspaceMember) {
      res.status(403).json({ error: "Access Denied." });
      return;
    }

    const channels = await prisma.channel.findMany({
      where: {
        workspaceId,
        OR: [{ type: "PUBLIC" }, { members: { some: { userId } } }],
      },
      orderBy: { createdAt: "asc" },
    });

    const readStates = await prisma.channelMember.findMany({
      where: {
        userId,
        channelId: { in: channels.map((c) => c.id) },
      },
    });

    const fallbackBaselineDate = isWorkspaceMember.createdAt || new Date();

    const hydratedChannels = await Promise.all(
      channels.map(async (channel) => {
        const myState = readStates.find((rs) => rs.channelId === channel.id);

        const unreadCount = await prisma.message.count({
          where: {
            channelId: channel.id,
            createdAt: { gt: myState?.lastReadAt || fallbackBaselineDate },
            senderId: { not: userId },
          },
        });

        return {
          ...channel,
          unreadCount,
          isBold: unreadCount > 0,
        };
      }),
    );

    res.status(200).json(hydratedChannels);
  } catch (error) {
    console.error("❌ Fetching Channels Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 3. REST API: MARK CHANNEL AS READ
export const markChannelAsRead = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { channelId } = req.body;
    const userId = req.user!.userId;

    if (!channelId) {
      res.status(400).json({ error: "Channel ID is required" });
      return;
    }

    await prisma.channelMember.upsert({
      where: { userId_channelId: { userId, channelId } },
      update: { lastReadAt: new Date() },
      create: { userId, channelId, lastReadAt: new Date() },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Mark Read Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 4. INVITE USERS TO CHANNEL
export const inviteToChannel = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const { userIds } = req.body;
    const inviterId = req.user!.userId;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ error: "Please provide users to invite." });
      return;
    }

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      res.status(404).json({ error: "Channel not found." });
      return;
    }

    const inviterWorkspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: inviterId,
          workspaceId: channel.workspaceId,
        },
      },
    });

    if (!inviterWorkspaceMember || inviterWorkspaceMember.role !== "OWNER") {
      res.status(403).json({
        error:
          "Strictly Restricted: Only Workspace Owners can invite members to private channels.",
      });
      return;
    }

    const isInviterInChannel = await prisma.channelMember.findUnique({
      where: { userId_channelId: { userId: inviterId, channelId } },
    });

    if (!isInviterInChannel) {
      res.status(403).json({
        error: "You cannot invite people to a channel you are not in.",
      });
      return;
    }

    const workspaceMembers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: channel.workspaceId,
        userId: { in: userIds },
      },
      select: { userId: true },
    });

    const validUserIds = workspaceMembers.map((wm) => wm.userId);

    if (validUserIds.length === 0) {
      res.status(400).json({
        error: "None of the provided users belong to this workspace.",
      });
      return;
    }

    await prisma.channelMember.createMany({
      data: validUserIds.map((id) => ({
        channelId,
        userId: id,
        lastReadAt: new Date(),
      })),
      skipDuplicates: true,
    });

    res.status(200).json({ success: true, addedUsers: validUserIds.length });
  } catch (error) {
    console.error("❌ Channel Invite Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 5. GET CHANNEL MEMBERS (Production Level API with Roles)
export const getChannelMembers = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const userId = req.user!.userId;

    // 1. Fetch channel for workspace ID and security checks
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: { members: true },
    });

    if (!channel) {
      res.status(404).json({ error: "Channel not found." });
      return;
    }

    // 🛡️ SECURITY GATE for private channels
    if (channel.type === "PRIVATE") {
      const isMember = channel.members.some((m) => m.userId === userId);
      if (!isMember) {
        res.status(403).json({
          error: "Access Denied. You are not a member of this private channel.",
        });
        return;
      }
    }

    // 2. Fetch basic user details from the channel
    const channelMembers = await prisma.channelMember.findMany({
      where: { channelId },
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true, email: true },
        },
      },
    });

    // 3. 🚀 THE ARCHITECTURE FIX: User ke roles Workspace se fetch karo
    const userIds = channelMembers.map((m) => m.userId);
    const workspaceRoles = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: channel.workspaceId,
        userId: { in: userIds },
      },
      select: { userId: true, role: true },
    });

    // 4. Data map karke combine karo aur 'role' explicitly frontend ko bhejo
    const formattedMembers = channelMembers.map((m) => {
      const workspaceMember = workspaceRoles.find(
        (wm) => wm.userId === m.userId,
      );
      return {
        ...m.user,
        role: workspaceMember ? workspaceMember.role : "MEMBER", // Inject Role!
      };
    });

    res.status(200).json(formattedMembers);
  } catch (error) {
    console.error("❌ Fetching Channel Members Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
