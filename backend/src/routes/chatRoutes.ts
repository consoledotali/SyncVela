import express from "express";
import { getUnreadCounts } from "../controllers/chatController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = express.Router();

router.use(authMiddleware);

router.get("/unread-counts", getUnreadCounts);

export default router;
