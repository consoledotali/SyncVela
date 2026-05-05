import { Router } from "express";
import { generatePresignedUrl } from "../controllers/uploadController";

const router = Router();

// Route: POST /api/upload/presign
router.post("/presign", generatePresignedUrl);

export default router;
