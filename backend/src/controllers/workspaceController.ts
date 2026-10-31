import { Response } from "express";
import prisma from "../config/db";
import { AuthenticatedRequest } from "./channelController";
import { workspaceOwnershipTransferSchema } from "./workspaceGovernanceSchemas";

// 1. CREATE WORKSPACE
export const createWorkspace = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { name, imageUrl } = req.body;
    const userId = req.user!.userId;

    if (!name) {
      res.status(400).json({ error: "Workspace name is strictly required." });
      return;
    }

    const workspace = await prisma.$transaction(async (tx) => {
      const newWorkspace = await tx.workspace.create({
        data: { name, imageUrl },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: newWorkspace.id,
          userId: userId,
          role: "OWNER",
        },
      });

      return newWorkspace;
    });

    const workspaceWithOwner = {
      ...workspace,
      ownerId: userId,
    };

    res.status(201).json(workspaceWithOwner);
  } catch (error) {
    console.error("❌ Workspace Creation Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 2. GET USER'S WORKSPACES
export const getUserWorkspaces = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const workspaces = await prisma.workspace.findMany({
      where: {
        members: { some: { userId: userId } },
      },
      include: {
        members: {
          where: { role: "OWNER" },
          select: { userId: true, role: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const formattedWorkspaces = workspaces.map((ws) => {
      const ownerRecord = ws.members.find((m) => m.role === "OWNER");
      return {
        ...ws,
        ownerId: ownerRecord ? ownerRecord.userId : null,
      };
    });

    res.status(200).json(formattedWorkspaces);
  } catch (error) {
    console.error("❌ Fetching Workspaces Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 3. JOIN WORKSPACE VIA INVITE CODE
export const joinWorkspace = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const inviteCode = req.params.inviteCode as string;
    const userId = req.user!.userId;

    const workspace = await prisma.workspace.findUnique({
      where: { inviteCode },
      include: { members: true },
    });

    if (!workspace) {
      res.status(404).json({ error: "Invalid invite code." });
      return;
    }

    const isAlreadyMember = workspace.members.some((m) => m.userId === userId);
    if (isAlreadyMember) {
      res.status(400).json({
        error: "You are already in this workspace.",
        workspaceId: workspace.id,
      });
      return;
    }

    const newMemberRecord = await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: userId,
        role: "MEMBER",
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });

    const io = req.app.get("socketio");

    if (io) {
      io.to(`workspace_${workspace.id}`).emit("workspace_member_joined", {
        workspaceId: workspace.id,
        user: newMemberRecord.user,
      });
    }

    res
      .status(200)
      .json({ message: "Joined successfully", workspaceId: workspace.id });
  } catch (error) {
    console.error("❌ Joining Workspace Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 4. GET WORKSPACE MEMBERS
export const getWorkspaceMembers = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const currentUserId = req.user!.userId;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true, isDeleted: true },
            },
          },
        },
      },
    });

    if (!workspace) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    // Security check: requester must be a member of this workspace
    const isRequesterMember = workspace.members.some(
      (m) => m.userId === currentUserId,
    );
    if (!isRequesterMember) {
      res.status(403).json({ error: "Access denied to workspace" });
      return;
    }

    // Fetch all 1:1 conversations for current user in THIS workspace
    const conversations = await prisma.conversation.findMany({
      where: {
        workspaceId,
        isGroup: false,
        participants: { some: { userId: currentUserId } },
      },
      include: {
        participants: true,
      },
    });

    const conversationByPeerId = new Map<string, (typeof conversations)[0]>();
    for (const conv of conversations) {
      const peer = conv.participants.find((p) => p.userId !== currentUserId);
      if (peer) {
        conversationByPeerId.set(peer.userId, conv);
      }
    }

    const membersWithTime = await Promise.all(
      workspace.members.map(async (m) => {
        const conv = conversationByPeerId.get(m.user.id);
        let unreadCount = 0;
        let roomId: string | null = null;
        let lastMessageAt: Date | null = null;
        let isActiveChat = false;

        if (conv) {
          roomId = conv.id;
          lastMessageAt = conv.lastMessageAt || null;
          isActiveChat = !!conv.lastMessageAt;
          const myParticipant = conv.participants.find(
            (p) => p.userId === currentUserId,
          );
          unreadCount = await prisma.message.count({
            where: {
              conversationId: conv.id,
              createdAt: { gt: myParticipant?.lastReadAt || new Date(0) },
              senderId: { not: currentUserId },
            },
          });
        }

        return {
          id: m.user.id,
          name: m.user.isDeleted ? "Deleted User" : m.user.name,
          email: m.user.isDeleted ? "" : m.user.email,
          avatarUrl: m.user.isDeleted ? null : m.user.avatarUrl,
          role: m.role,
          roomId,
          unreadCount,
          lastMessageAt,
          isActiveChat,
        };
      }),
    );

    res.status(200).json(membersWithTime);
  } catch (error) {
    console.error("❌ Fetching Workspace Members Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 5. DELETE WORKSPACE
export const deleteWorkspace = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const workspaceId = req.params.workspaceId as string;

    await prisma.$transaction(async (tx) => {
      const channels = await tx.channel.findMany({ where: { workspaceId } });
      const channelIds = channels.map((c) => c.id);

      if (channelIds.length > 0) {
        await tx.message.deleteMany({
          where: { channelId: { in: channelIds } },
        });
        await tx.channelMember.deleteMany({
          where: { channelId: { in: channelIds } },
        });
        await tx.channel.deleteMany({ where: { workspaceId } });
      }

      await tx.workspaceMember.deleteMany({ where: { workspaceId } });
      await tx.workspace.delete({ where: { id: workspaceId } });
    });

    const io = req.app.get("socketio");
    if (io) {
      io.to(`workspace_${workspaceId}`).emit("workspace_deleted", workspaceId);
    }

    res
      .status(200)
      .json({ success: true, message: "Workspace completely deleted." });
  } catch (error) {
    console.error("❌ Workspace Deletion Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 6. UPDATE WORKSPACE MEMBER ROLE
export const updateWorkspaceMemberRole = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const workspaceId = req.body.workspaceId as string;
    const targetUserId = req.body.targetUserId as string;
    const newRole = req.body.newRole as string;
    const currentUserId = req.user!.userId;

    if (!workspaceId || !targetUserId || !newRole) {
      res.status(400).json({
        error: "Missing required fields: workspaceId, targetUserId, newRole",
      });
      return;
    }

    if (!["ADMIN", "MEMBER", "GUEST"].includes(newRole)) {
      res.status(400).json({
        error: "Invalid role assignment. Allowed values: ADMIN, MEMBER, GUEST",
      });
      return;
    }

    // EDGE CASE: Stop user from modifying their own role
    if (currentUserId === targetUserId) {
      res.status(400).json({ error: "You cannot change your own role." });
      return;
    }

    const targetMember = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    });

    if (!targetMember) {
      res
        .status(404)
        .json({ error: "User is not a member of this workspace." });
      return;
    }

    if (targetMember.role === "OWNER") {
      res.status(400).json({
        error: "System Lock: Workspace Owner's role cannot be modified.",
      });
      return;
    }

    const updatedMember = await prisma.workspaceMember.update({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
      data: { role: newRole as any },
      include: { user: { select: { id: true, name: true } } },
    });

    // 🚀 THE QUARANTINE ENGINE FIX
    let revokedChannelIds: string[] = [];

    if (newRole === "GUEST") {
      // 🚨 DEMOTED TO GUEST: Strip access from ALL channels (Public & Private).
      // This enforces strict quarantine. The Admin must re-invite them manually.
      const allChannels = await prisma.channel.findMany({
        where: { workspaceId },
        select: { id: true },
      });
      revokedChannelIds = allChannels.map((c) => c.id);
    } else if (newRole === "MEMBER") {
      // 🚨 DEMOTED TO MEMBER: Only strip access from PRIVATE channels.
      // Members inherently have access to all PUBLIC channels.
      const privateChannels = await prisma.channel.findMany({
        where: { workspaceId, type: "PRIVATE" },
        select: { id: true },
      });
      revokedChannelIds = privateChannels.map((c) => c.id);
    }

    if (revokedChannelIds.length > 0) {
      await prisma.channelMember.deleteMany({
        where: { userId: targetUserId, channelId: { in: revokedChannelIds } },
      });
    }

    const io = req.app.get("socketio");
    if (io) {
      // Broadcast the role change to the workspace
      io.to(`workspace_${workspaceId}`).emit("member_role_updated", {
        workspaceId,
        userId: targetUserId,
        newRole,
      });

      // Force the demoted user's UI to wipe the revoked channels instantly
      if (revokedChannelIds.length > 0) {
        // Hum purana frontend event name "private_channels_revoked" hi use kar rahe hain
        // kyunke frontend filter logic explicitly private/public check nahi karti,
        // bas ID match kar ke channel sidebar se uda deti hai.
        io.to(targetUserId).emit("private_channels_revoked", {
          channelIds: revokedChannelIds,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully promoted ${updatedMember.user.name} to ${newRole}`,
    });
  } catch (error) {
    console.error("❌ Failed to update member role:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 7. TRANSFER WORKSPACE OWNERSHIP
export const transferWorkspaceOwnership = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const currentOwnerId = req.user!.userId;
    const parsedPayload = workspaceOwnershipTransferSchema.safeParse(req.body);

    if (!parsedPayload.success) {
      res.status(400).json({ error: "A valid new workspace owner is required." });
      return;
    }

    const { newOwnerId } = parsedPayload.data;
    if (newOwnerId === currentOwnerId) {
      res.status(400).json({ error: "You already own this workspace." });
      return;
    }

    const [currentOwner, newOwner] = await Promise.all([
      prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: { userId: currentOwnerId, workspaceId },
        },
        select: { role: true },
      }),
      prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: newOwnerId, workspaceId } },
        select: { userId: true },
      }),
    ]);

    if (currentOwner?.role !== "OWNER") {
      res.status(403).json({ error: "Only the current workspace owner can transfer ownership." });
      return;
    }
    if (!newOwner) {
      res.status(400).json({ error: "The new owner must already belong to this workspace." });
      return;
    }

    await prisma.$transaction(async (tx) => {
      const demotion = await tx.workspaceMember.updateMany({
        where: {
          userId: currentOwnerId,
          workspaceId,
          role: "OWNER",
        },
        data: { role: "ADMIN" },
      });
      if (demotion.count !== 1) {
        throw new Error("Workspace ownership changed before this transfer could complete.");
      }

      await tx.workspaceMember.update({
        where: { userId_workspaceId: { userId: newOwnerId, workspaceId } },
        data: { role: "OWNER" },
      });
    });

    const payload = { workspaceId, previousOwnerId: currentOwnerId, newOwnerId };
    const io = req.app.get("socketio");
    io?.to(`workspace_${workspaceId}`).emit("workspace_ownership_transferred", payload);

    res.status(200).json({ success: true, ...payload });
  } catch (error) {
    console.error("❌ Workspace Ownership Transfer Failed:", error);
    res.status(500).json({ error: "Unable to transfer workspace ownership." });
  }
};

// 8. KICK MEMBER FROM WORKSPACE
export const removeWorkspaceMember = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const targetUserId = req.params.userId as string;
    const currentUserId = req.user!.userId;

    if (currentUserId === targetUserId) {
      res
        .status(400)
        .json({ error: "You cannot kick yourself from the workspace." });
      return;
    }

    const targetMember = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    });

    if (!targetMember) {
      res.status(404).json({ error: "Member not found in this workspace." });
      return;
    }

    if (targetMember.role === "OWNER") {
      res
        .status(400)
        .json({ error: "System Lock: You cannot kick the Workspace Owner." });
      return;
    }

    await prisma.$transaction(async (tx) => {
      const channels = await tx.channel.findMany({ where: { workspaceId } });
      const channelIds = channels.map((c) => c.id);

      if (channelIds.length > 0) {
        await tx.channelMember.deleteMany({
          where: { channelId: { in: channelIds }, userId: targetUserId },
        });
      }

      await tx.workspaceMember.delete({
        where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
      });
    });

    const io = req.app.get("socketio");
    if (io) {
      io.to(`workspace_${workspaceId}`).emit("member_kicked", {
        workspaceId,
        userId: targetUserId,
      });
      io.to(targetUserId).emit("workspace_revoked", workspaceId);
      io.in(targetUserId).socketsLeave(`workspace_${workspaceId}`);
    }

    res.status(200).json({
      success: true,
      message: "Member successfully removed from workspace.",
    });
  } catch (error) {
    console.error("❌ Failed to kick member:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
