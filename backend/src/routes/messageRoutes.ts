import { Router } from "express";
import {
  getChannelMessages,
  getDirectMessages,
  getThreadMessages, // 🚀 IMPORTED NEW CONTROLLER
} from "../controllers/messageController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/channel/:channelId", getChannelMessages);
router.get("/dm/:roomId", getDirectMessages);
router.get("/thread/:parentId", getThreadMessages);

export default router;
