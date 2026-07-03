import { Router } from "express";
import {
  createChannel,
  getWorkspaceChannels,
  markChannelAsRead,
  inviteToChannel,
  getChannelMembers,
} from "../controllers/channelController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.post("/", createChannel);
router.get("/:workspaceId", getWorkspaceChannels);
router.post("/mark-read", markChannelAsRead);
router.post("/:channelId/invite", inviteToChannel);
router.get("/:channelId/members", getChannelMembers);

export default router;
