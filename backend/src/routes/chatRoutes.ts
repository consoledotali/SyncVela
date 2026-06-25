import express from "express";
import {
  getPrivateMessages,
  getUnreadCounts,
} from "../controllers/chatController";
import { authMiddleware } from "../middlewares/authMiddleware"; // 🛡️ Import Gatekeeper

const router = express.Router();

// 🛡️ SECURITY FIX 4: Protect ALL chat routes. Token ke baghair yahan parinda bhi par na maar sake.
router.use(authMiddleware);

router.get("/unread-counts", getUnreadCounts);
router.get("/:roomId/messages", getPrivateMessages);

export default router;
