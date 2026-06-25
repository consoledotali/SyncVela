import { Request, Response } from "express";
import prisma from "../config/db";

// 1. CREATE WORKSPACE (With Transactional Safety)
export const createWorkspace = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { name, imageUrl } = req.body;
    // Assuming your authMiddleware sets req.user
    const userId = (req as any).user?.userId;

    if (!name) {
      res.status(400).json({ error: "Workspace name is strictly required." });
      return;
    }

    // 🛡️ THE ARCHITECTURAL FIX: Prisma Transaction
    // Agar koi ek operation fail hua, toh poora process waapas roll-back ho jayega.
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
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    const workspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: { userId: userId },
        },
      },
      include: {
        channels: true, // Fetch channels inside workspace
      },
    });

    res.status(200).json(workspaces);
  } catch (error) {
    console.error("❌ Fetching Workspaces Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 3. JOIN WORKSPACE VIA INVITE CODE
export const joinWorkspace = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // 🛡️ THE FIX: Force TypeScript to treat this as a single string
    const inviteCode = req.params.inviteCode as string;
    const userId = (req as any).user?.userId;

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
