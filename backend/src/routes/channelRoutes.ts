import { Router } from "express";
import {
  createChannel,
  getWorkspaceChannels,
  markChannelAsRead,
  inviteToChannel,
  getChannelMembers,
  leaveChannel,
  deleteChannel,
  setChannelMemberVisibility,
} from "../controllers/channelController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requirePermission } from "../middlewares/rbacMiddleware";

const router = Router();

router.use(authMiddleware);

router.post("/", requirePermission("CREATE_CHANNEL"), createChannel);
router.get("/:workspaceId", requirePermission("VIEW_WORKSPACE"), getWorkspaceChannels);
router.post("/mark-read", markChannelAsRead);
router.post("/:channelId/invite", inviteToChannel);
router.post("/:channelId/leave", leaveChannel);
router.delete("/:channelId", deleteChannel);
router.patch("/:channelId/member-visibility", setChannelMemberVisibility);
router.get("/:channelId/members", getChannelMembers);

export default router;
