import { Request, Response } from "express";
import prisma from "../config/db";

// 🛡️ NAYA: Strict Custom Interface
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
  };
}

// 1. CREATE NEW CHANNEL
export const createChannel = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, type, workspaceId } = req.body;
    
    // Ab TS rote ga nahi kyunke AuthenticatedRequest mein user defined hai
    const userId = req.user!.userId; 

    if (!name || !workspaceId) {
      res.status(400).json({ error: "Channel name and Workspace ID are strictly required." });
      return;
    }

    const isWorkspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId },
      },
    });

    if (!isWorkspaceMember) {
      res.status(403).json({ error: "Access Denied: You are not a member of this workspace." });
      return;
    }

    if (isWorkspaceMember.role === "MEMBER" || isWorkspaceMember.role === "GUEST") {
      res.status(403).json({ error: "Unauthorized: Only Workspace Admins/Owners can create channels." });
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
        data: {
          channelId: newChannel.id,
          userId, 
        },
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
export const getWorkspaceChannels = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const workspaceId = req.params.workspaceId as string;
    const userId = req.user!.userId;

    const isWorkspaceMember = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: { userId, workspaceId },
      },
    });

    if (!isWorkspaceMember) {
      res.status(403).json({ error: "Access Denied: You do not belong to this workspace." });
      return;
    }

    const channels = await prisma.channel.findMany({
      where: {
        workspaceId,
        OR: [
          { type: "PUBLIC" },
          {
            members: {
              some: { userId },
            },
          },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    res.status(200).json(channels);
  } catch (error) {
    console.error("❌ Fetching Channels Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};