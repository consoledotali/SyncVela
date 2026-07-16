import express from "express";
import {
  getUsersForSidebar,
  updateAvatar,
} from "../controllers/userController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = express.Router();

router.use(authMiddleware);
router.get("/", getUsersForSidebar);
router.put("/avatar", updateAvatar);

export default router;
