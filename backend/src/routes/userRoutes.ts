import express from "express";
import {
  getUsersForSidebar,
  serveAvatarObject,
  updateAvatar,
} from "../controllers/userController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = express.Router();

router.get("/avatar-object", serveAvatarObject);
router.use(authMiddleware);
router.get("/", getUsersForSidebar);
router.put("/avatar", updateAvatar);

export default router;
