import express from "express";
import { getUsersForSidebar } from "../controllers/userController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = express.Router();

// 🛡️ SECURITY FIX: Users ki list sirf verified members ko dikhegi
router.use(authMiddleware);

// API route protected hai. Frontend se "?currentUserId=" bhejne ki zaroorat nahi!
router.get("/", getUsersForSidebar);

export default router;
