import { Router } from "express";
import {
  getChannelMessages,
  getDirectMessages,
} from "../controllers/messageController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

// 🛡️ SECURITY: Protect all history endpoints
router.use(authMiddleware);

router.get("/channel/:channelId", getChannelMessages);
router.get("/dm/:roomId", getDirectMessages);

export default router;
