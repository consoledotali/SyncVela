import { Response } from "express";
import prisma from "../config/db";
import { AuthenticatedRequest } from "./channelController";

// 1. CREATE WORKSPACE (NO DEFAULT CHANNELS, REAL-TIME OWNER ID)
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

// 2. GET USER'S WORKSPACES (THE DATA EXPOSURE FIX)
export const getUserWorkspaces = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const workspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: { userId: userId },
        },
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

// 3. JOIN WORKSPACE VIA INVITE CODE (THE SAFE SOCKET EXTRACTION)
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
      res.status(400).json({ error: "You are already in this workspace." });
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

    // 🚀 THE CLEAN ARCHITECTURE FIX: Fetch io directly from the app state
    const io = req.app.get("io");

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

    const memberRecord = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });

    if (!memberRecord || memberRecord.role !== "OWNER") {
      res.status(403).json({
        error:
          "Strictly Restricted: Only the Workspace Owner can delete this workspace.",
      });
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
