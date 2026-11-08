import { Request, Response } from "express";
import { ChannelType, Prisma } from "../generated/prisma/client";
import prisma from "../config/db";
import { authorizeRBAC } from "../utils/rbac";
import {
  channelMemberVisibilitySchema,
} from "../validators/channelValidators";

export interface AuthenticatedRequest extends Request {
  user?: { userId: string };
}

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

    const channel = await prisma.$transaction(async (tx) => {
      const newChannel = await tx.channel.create({
        data: {
          name: name.toLowerCase().trim().replace(/\s+/g, "-"),
          type,
          workspaceId,
          ownerId: userId,
        },
      });

      await tx.channelMember.create({
        data: { channelId: newChannel.id, userId },
      });

      if (type === "PRIVATE") {
        const owner = await tx.workspaceMember.findFirst({
          where: { workspaceId, role: "OWNER" },
          select: { userId: true },
        });
        if (owner && owner.userId !== userId) {
          await tx.channelMember.create({
            data: { channelId: newChannel.id, userId: owner.userId },
          });
        }
      }

      return newChannel;
    });

    const io = req.app.get("socketio");
    if (io) {
      if (type === "PUBLIC") {
        io.to(`workspace_${workspaceId}`).emit("channel_created", channel);
      } else {
        const privateMemberIds = await prisma.channelMember.findMany({
          where: { channelId: channel.id },
          select: { userId: true },
        });
        privateMemberIds.forEach(({ userId: memberId }) => {
          io.to(memberId).emit("added_to_channel", channel);
        });
      }
    }

    res.status(201).json(channel);
  } catch (error) {
    console.error("❌ Channel Creation Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getWorkspaceChannels = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const userId = req.user!.userId;

    const memberRecord = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { role: true, createdAt: true },
    });

    if (!memberRecord) {
      res
        .status(403)
        .json({ error: "Access denied. Not a member of this workspace." });
      return;
    }

    const channelQuery: Prisma.ChannelWhereInput = { workspaceId };

    if (memberRecord.role === "GUEST") {
      channelQuery.members = { some: { userId, isHidden: false } };
    } else {
      channelQuery.OR = [
        {
          type: ChannelType.PUBLIC,
          NOT: { members: { some: { userId, isHidden: true } } },
        },
        {
          type: ChannelType.PRIVATE,
          members: { some: { userId, isHidden: false } },
        },
      ];
    }

    const channels = await prisma.channel.findMany({
      where: channelQuery,
      orderBy: { createdAt: "asc" },
    });

    const readStates = await prisma.channelMember.findMany({
      where: { userId, channelId: { in: channels.map((c) => c.id) } },
    });

    const fallbackBaselineDate = memberRecord.createdAt || new Date();

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

        return { ...channel, unreadCount, isBold: unreadCount > 0 };
      }),
    );

    res.status(200).json(hydratedChannels);
  } catch (error) {
    console.error("❌ Fetching Channels Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

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

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, type: true, workspaceId: true },
    });
    if (!channel) {
      res.status(404).json({ error: "Channel not found" });
      return;
    }
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: channel.workspaceId } },
      select: { role: true },
    });
    const explicitMembership = await prisma.channelMember.findUnique({
      where: { userId_channelId: { userId, channelId } },
      select: { id: true },
    });
    const canRead = workspaceMember && (
      channel.type === "PUBLIC"
        ? workspaceMember.role !== "GUEST" || Boolean(explicitMembership)
        : Boolean(explicitMembership)
    );
    if (!canRead) {
      res.status(403).json({ error: "Access denied for this channel" });
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

    const invitePermission = await authorizeRBAC(
      inviterId,
      channel.workspaceId,
      "INVITE_USERS",
    );
    if (!invitePermission.allowed) {
      res.status(403).json({ error: invitePermission.reason });
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
      where: { workspaceId: channel.workspaceId, userId: { in: userIds } },
      select: { userId: true },
    });

    const validUserIds = workspaceMembers.map((wm) => wm.userId);

    if (validUserIds.length === 0) {
      res.status(400).json({
        error: "None of the provided users belong to this workspace.",
      });
      return;
    }

    const existingMemberships = await prisma.channelMember.findMany({
      where: { channelId, userId: { in: validUserIds } },
      select: { userId: true },
    });
    const existingUserIds = new Set(existingMemberships.map((member) => member.userId));
    const usersToAdd = validUserIds.filter((id) => !existingUserIds.has(id));

    if (usersToAdd.length === 0) {
      res.status(409).json({ error: "Selected people are already channel members." });
      return;
    }

    await prisma.channelMember.createMany({
      data: usersToAdd.map((id) => ({
        channelId,
        userId: id,
        lastReadAt: new Date(),
      })),
      skipDuplicates: true,
    });

    const io = req.app.get("socketio");
    if (io) {
      usersToAdd.forEach((id) => {
        io.to(id).emit("added_to_channel", channel);
      });
    }

    res.status(200).json({ success: true, addedUsers: usersToAdd.length });
  } catch (error) {
    console.error("❌ Channel Invite Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const emitChannelAccessUpdate = (
  req: AuthenticatedRequest,
  userId: string,
  payload: { channelId: string; workspaceId: string; visible: boolean },
) => {
  const io = req.app.get("socketio");
  io?.to(userId).emit("channel_access_updated", payload);
};

export const leaveChannel = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const userId = req.user!.userId;
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });

    if (!channel) {
      res.status(404).json({ error: "Channel not found." });
      return;
    }
    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: channel.workspaceId } },
      select: { id: true },
    });
    if (!workspaceMember) {
      res.status(403).json({ error: "You are not a workspace member." });
      return;
    }

    await prisma.channelMember.upsert({
      where: { userId_channelId: { userId, channelId } },
      update: { isHidden: true },
      create: { userId, channelId, isHidden: true },
    });

    emitChannelAccessUpdate(req, userId, {
      channelId,
      workspaceId: channel.workspaceId,
      visible: false,
    });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Channel Leave Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deleteChannel = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const actorId = req.user!.userId;
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        id: true,
        name: true,
        type: true,
        workspaceId: true,
        members: { select: { userId: true } },
      },
    });

    if (!channel) {
      res.status(404).json({ error: "Channel not found." });
      return;
    }

    const actorMembership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId: actorId, workspaceId: channel.workspaceId },
      },
      select: { role: true },
    });
    if (actorMembership?.role !== "OWNER") {
      res.status(403).json({
        error: "Only the workspace owner can delete a channel.",
      });
      return;
    }

    await prisma.channel.delete({ where: { id: channelId } });

    const io = req.app.get("socketio");
    const payload = {
      channelId: channel.id,
      channelName: channel.name,
      workspaceId: channel.workspaceId,
    };
    if (io) {
      if (channel.type === "PUBLIC") {
        io.to(`workspace_${channel.workspaceId}`).emit("channel_deleted", payload);
      } else {
        channel.members.forEach(({ userId }) => {
          io.to(userId).emit("channel_deleted", payload);
        });
      }

      io.in(`channel_${channel.id}`).socketsLeave(`channel_${channel.id}`);
    }

    res.status(200).json({ success: true, ...payload });
  } catch (error) {
    console.error("❌ Channel Delete Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const setChannelMemberVisibility = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const actorId = req.user!.userId;
    const parsedPayload = channelMemberVisibilitySchema.safeParse(req.body);
    if (!parsedPayload.success) {
      res.status(400).json({ error: "A member and visibility value are required." });
      return;
    }
    const { userId: targetUserId, visible } = parsedPayload.data;

    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) {
      res.status(404).json({ error: "Channel not found." });
      return;
    }
    const actorWorkspaceMembership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId: actorId, workspaceId: channel.workspaceId },
      },
      select: { role: true },
    });
    if (actorWorkspaceMembership?.role !== "OWNER") {
      res.status(403).json({
        error: "Only the workspace owner can manage channel visibility.",
      });
      return;
    }
    if (targetUserId === actorId) {
      res.status(400).json({ error: "You cannot change your own channel visibility." });
      return;
    }

    const targetMembership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId: targetUserId, workspaceId: channel.workspaceId },
      },
      select: { id: true },
    });
    if (!targetMembership) {
      res.status(400).json({ error: "This person is not a workspace member." });
      return;
    }

    await prisma.channelMember.upsert({
      where: { userId_channelId: { userId: targetUserId, channelId } },
      update: { isHidden: !visible },
      create: { userId: targetUserId, channelId, isHidden: !visible },
    });

    emitChannelAccessUpdate(req, targetUserId, {
      channelId,
      workspaceId: channel.workspaceId,
      visible,
    });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Channel Visibility Update Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getChannelMembers = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const userId = req.user!.userId;

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: { members: true },
    });

    if (!channel) {
      res.status(404).json({ error: "Channel not found." });
      return;
    }

    const workspaceMember = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: channel.workspaceId } },
      select: { role: true },
    });
    if (!workspaceMember) {
      res.status(403).json({ error: "Access denied. Not a workspace member." });
      return;
    }

    if (channel.type === "PRIVATE") {
      const isMember = channel.members.some((m) => m.userId === userId);
      if (!isMember) {
        res.status(403).json({
          error: "Access Denied. You are not a member of this private channel.",
        });
        return;
      }
    }

    if (channel.type === "PUBLIC" && workspaceMember.role === "GUEST") {
      const isGuestInvited = channel.members.some((member) => member.userId === userId);
      if (!isGuestInvited) {
        res.status(403).json({ error: "Guests must be invited to access this channel." });
        return;
      }
    }

    if (channel.type === "PUBLIC") {
      const coreMembers = await prisma.workspaceMember.findMany({
        where: { workspaceId: channel.workspaceId, role: { not: "GUEST" } },
        include: {
          user: {
            select: { id: true, name: true, avatarUrl: true, email: true },
          },
        },
      });

      const explicitMembers = await prisma.channelMember.findMany({
        where: { channelId },
        include: {
          user: {
            select: { id: true, name: true, avatarUrl: true, email: true },
          },
        },
      });

      const explicitUserIds = explicitMembers.map((m) => m.userId);
      const explicitRoles = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: channel.workspaceId,
          userId: { in: explicitUserIds },
        },
        select: { userId: true, role: true },
      });

      const visibilityByUserId = new Map(
        explicitMembers.map((member) => [member.userId, member.isHidden]),
      );
      const formattedCore = coreMembers.map((wm) => ({
        ...wm.user,
        role: wm.role,
        isHidden: visibilityByUserId.get(wm.user.id) || false,
      }));

      const coreUserIds = new Set(formattedCore.map((m) => m.id));

      const formattedExplicit = explicitMembers
        .filter((m) => !coreUserIds.has(m.userId))
        .map((m) => {
          const role =
            explicitRoles.find((r) => r.userId === m.userId)?.role || "GUEST";
          return { ...m.user, role, isHidden: m.isHidden };
        });

      res.status(200).json([...formattedCore, ...formattedExplicit]);
      return;
    }

    const channelMembers = await prisma.channelMember.findMany({
      where: { channelId },
      include: {
        user: {
          select: { id: true, name: true, avatarUrl: true, email: true },
        },
      },
    });

    const userIds = channelMembers.map((m) => m.userId);
    const workspaceRoles = await prisma.workspaceMember.findMany({
      where: { workspaceId: channel.workspaceId, userId: { in: userIds } },
      select: { userId: true, role: true },
    });

    const formattedMembers = channelMembers.map((m) => {
      const workspaceMember = workspaceRoles.find(
        (wm) => wm.userId === m.userId,
      );
      return {
        ...m.user,
        role: workspaceMember ? workspaceMember.role : "MEMBER",
        isHidden: m.isHidden,
      };
    });

    res.status(200).json(formattedMembers);
  } catch (error) {
    console.error("❌ Fetching Channel Members Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
