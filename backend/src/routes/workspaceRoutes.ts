import { Router } from "express";
import {
  createWorkspace,
  getUserWorkspaces,
  joinWorkspace,
  getWorkspaceMembers,
} from "../controllers/workspaceController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

// Protect all workspace routes
router.use(authMiddleware);

router.post("/", createWorkspace);
router.get("/", getUserWorkspaces);
router.post("/join/:inviteCode", joinWorkspace);
router.get("/:workspaceId/members", getWorkspaceMembers);

export default router;
