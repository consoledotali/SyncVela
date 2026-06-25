import { Router } from "express";
import { generatePresignedUrl } from "../controllers/uploadController";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

// 🛡️ SECURITY FIX: S3 bucket ko public kachra kundi banne se roko.
// Sirf verified users hi file upload karne ka URL maang sakte hain.
router.use(authMiddleware);

router.post("/presign", generatePresignedUrl);

export default router;
