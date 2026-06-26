import { Response } from "express";
import prisma from "../config/db";
import { AuthenticatedRequest } from "./channelController";

// 1. CREATE WORKSPACE (With Transactional Safety)
export const createWorkspace = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { name, imageUrl } = req.body;

    // 🛡️ THE FIX: Ab 'any' ki zaroorat nahi. Token guarantee de raha hai.
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
          role: "OWNER", // Creator is always the owner
        },
      });

      await tx.channel.create({
        data: {
          name: "general",
          workspaceId: newWorkspace.id,
          type: "PUBLIC",
        },
      });

      return newWorkspace;
    });

    res.status(201).json(workspace);
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
        members: {
          some: { userId: userId },
        },
      },
      // 🛡️ THE FIX: 'include: { channels: true }' REMOVED.
      // Hum payload chota rakh rahe hain. Channels alag API se lazy-load honge.
      orderBy: { createdAt: "asc" },
    });

    res.status(200).json(workspaces);
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
      res.status(400).json({ error: "You are already in this workspace." });
      return;
    }

    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: userId,
        role: "MEMBER",
      },
    });

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

    // 🛡️ Data map karo taake sirf User objects frontend par jayein
    const members = workspace.members.map((m) => m.user);

    res.status(200).json(members);
  } catch (error) {
    console.error("❌ Fetching Workspace Members Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
