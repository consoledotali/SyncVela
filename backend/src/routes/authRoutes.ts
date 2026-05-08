import { Router } from "express";
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  verifyOTPHandler,
  googleLoginHandler,
} from "../controllers/authController";

const router = Router();

// Authentication Routes
router.post("/register", registerUser);
router.post("/login", loginUser);

// Google OAuth Route
router.post("/google", googleLoginHandler);

// OTP Verify karne ka strict route
router.post("/verify-otp", verifyOTPHandler);

// Security & Session Routes
router.post("/refresh", refreshAccessToken);
router.post("/logout", logoutUser);

export default router;
