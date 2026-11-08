import { Router } from "express";
import {
  createWorkspace,
  getUserWorkspaces,
  joinWorkspace,
  getWorkspaceMembers,
  deleteWorkspace,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
  transferWorkspaceOwnership,
} from "../controllers/workspaceController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requirePermission } from "../middlewares/rbacMiddleware";

const router = Router();

router.use(authMiddleware);

router.post("/", createWorkspace);
router.get("/", getUserWorkspaces);
router.post("/join/:inviteCode", joinWorkspace);
router.get("/:workspaceId/members", requirePermission("VIEW_WORKSPACE"), getWorkspaceMembers);
router.delete(
  "/:workspaceId",
  requirePermission("DELETE_WORKSPACE"),
  deleteWorkspace,
);
router.put(
  "/members/role",
  requirePermission("MANAGE_WORKSPACE"),
  updateWorkspaceMemberRole,
);
router.post(
  "/:workspaceId/transfer-ownership",
  requirePermission("MANAGE_WORKSPACE"),
  transferWorkspaceOwnership,
);
router.delete(
  "/:workspaceId/members/:userId",
  requirePermission("MANAGE_WORKSPACE"),
  removeWorkspaceMember,
);

export default router;
