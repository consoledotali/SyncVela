import { Router } from "express";
import { generatePresignedUrl } from "../controllers/uploadController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.post("/presign", generatePresignedUrl);

export default router;
