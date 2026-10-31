import { Request, Response, NextFunction } from "express";
import { Permission, authorizeRBAC } from "../utils/rbac";

export const requirePermission = (requiredPermission: Permission) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.user?.userId;

      // Workspace ID route params se aaye ya request body se
      const workspaceId =
        req.params.workspaceId || req.body.workspaceId || req.query.workspaceId;

      if (!userId || !workspaceId) {
        res.status(400).json({
          error:
            "FATAL: Authorization context missing. Workspace ID is required.",
        });
        return;
      }

      // Check against DB and Role Matrix
      const authResult = await authorizeRBAC(
        userId,
        workspaceId,
        requiredPermission,
      );

      if (!authResult.allowed) {
        console.warn(
          `🚨 RBAC BLOCKED: User ${userId} tried to ${requiredPermission} on Workspace ${workspaceId}`,
        );
        res.status(403).json({ error: authResult.reason });
        return;
      }

      // Agar authorized hai, toh aagay janay do
      next();
    } catch (error) {
      console.error("❌ RBAC Middleware Crash:", error);
      res
        .status(500)
        .json({ error: "Internal server error during authorization check." });
    }
  };
};
