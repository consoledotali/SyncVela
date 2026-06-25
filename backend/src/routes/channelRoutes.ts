import { Router } from "express";
import {
  createChannel,
  getWorkspaceChannels,
} from "../controllers/channelController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.post("/", createChannel);
router.get("/:workspaceId", getWorkspaceChannels);

export default router;
