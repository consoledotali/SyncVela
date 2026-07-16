import { Router } from "express";
import {
  createWorkspace,
  getUserWorkspaces,
  joinWorkspace,
  getWorkspaceMembers,
  deleteWorkspace,
  updateWorkspaceMemberRole,
  removeWorkspaceMember,
} from "../controllers/workspaceController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

// Protect all workspace routes
router.use(authMiddleware);

router.post("/", createWorkspace);
router.get("/", getUserWorkspaces);
router.post("/join/:inviteCode", joinWorkspace);
router.get("/:workspaceId/members", getWorkspaceMembers);
router.delete("/:workspaceId", deleteWorkspace);
router.put("/members/role", updateWorkspaceMemberRole);
router.delete("/:workspaceId/members/:userId", removeWorkspaceMember);

export default router;
