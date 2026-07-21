import { Response } from "express";
import prisma from "../config/db";
import { AuthenticatedRequest } from "./channelController";
import { authorizeRBAC } from "../utils/rbac";

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
      // 🚀 THE FIX: Sending workspaceId back even on error
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
      io.to(workspace.id).emit("workspace_member_joined", {
        workspaceId: workspace.id,
        user: newMemberRecord.user,
      });
    } else {
      console.error("⚠️ WebSocket instance not found in Express App State!");
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
    const userId = req.user!.userId;

    // 🚀 THE ENTERPRISE GATEKEEPER
    const auth = await authorizeRBAC(userId, workspaceId, "VIEW_WORKSPACE");
    if (!auth.allowed) {
      res.status(403).json({ error: auth.reason });
      return;
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!workspace) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    const membersWithTime = await Promise.all(
      workspace.members.map(async (m) => {
        const lastMessage = await prisma.message.findFirst({
          where: { senderId: m.user.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        });

        return {
          ...m.user,
          role: m.role,
          lastMessageAt: lastMessage ? lastMessage.createdAt : null,
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
    const userId = req.user!.userId;

    // 🚀 THE ENTERPRISE GATEKEEPER
    const auth = await authorizeRBAC(userId, workspaceId, "DELETE_WORKSPACE");
    if (!auth.allowed) {
      res.status(403).json({ error: auth.reason });
      return;
    }

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

    res
      .status(200)
      .json({ success: true, message: "Workspace completely deleted." });
  } catch (error) {
    console.error("❌ Workspace Deletion Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 6. UPDATE WORKSPACE MEMBER ROLE (RBAC Enforced)
export const updateWorkspaceMemberRole = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    // 🚀 THE FIX: Cast explicitly to string to stop type union leakage
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

    const auth = await authorizeRBAC(
      currentUserId,
      workspaceId,
      "MANAGE_WORKSPACE",
    );
    if (!auth.allowed) {
      res.status(403).json({ error: auth.reason });
      return;
    }

    const targetMember = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    });

    if (targetMember?.role === "OWNER") {
      res.status(400).json({
        error: "System Lock: Workspace Owner's role cannot be modified.",
      });
      return;
    }

    const updatedMember = await prisma.workspaceMember.update({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
      data: { role: newRole as any }, // Cast to any or your Prisma Enum type
      include: { user: { select: { id: true, name: true } } },
    });

    const io = req.app.get("socketio");
    if (io) {
      io.to(workspaceId).emit("member_role_updated", {
        workspaceId,
        userId: targetUserId,
        newRole,
      });
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

// 7. KICK MEMBER FROM WORKSPACE (RBAC Enforced)
export const removeWorkspaceMember = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const targetUserId = req.params.userId as string;
    const currentUserId = req.user!.userId;

    const auth = await authorizeRBAC(
      currentUserId,
      workspaceId,
      "MANAGE_WORKSPACE",
    );
    if (!auth.allowed) {
      res.status(403).json({ error: auth.reason });
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
      io.to(workspaceId).emit("member_kicked", {
        workspaceId,
        userId: targetUserId,
      });
      io.to(targetUserId).emit("workspace_revoked", workspaceId);
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
