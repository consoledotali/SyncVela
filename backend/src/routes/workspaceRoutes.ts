import { Router } from "express";
import {
  createWorkspace,
  getUserWorkspaces,
  joinWorkspace,
} from "../controllers/workspaceController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

// Protect all workspace routes
router.use(authMiddleware);

router.post("/", createWorkspace);
router.get("/", getUserWorkspaces);
router.post("/join/:inviteCode", joinWorkspace);

export default router;
