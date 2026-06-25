import { Router } from "express";
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  verifyOTPHandler,
  googleLoginHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
} from "../controllers/authController";
import rateLimit from "express-rate-limit";

const router = Router();

// 🛡️ SECURITY FIX: Brute-Force Protection
// Ek IP address se 15 minute mein sirf 5 OTP attempts allowed hain.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: { error: "Too many verification attempts. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 10, 
  message: { error: "Too many login attempts. Please cool down." },
});

// Authentication Routes
router.post("/register", registerUser);
router.post("/login", loginLimiter, loginUser); // Login par limit laga di
router.post("/verify-otp", otpLimiter, verifyOTPHandler);

// Google OAuth Route
router.post("/google", googleLoginHandler);

// Password Reset Routes
router.post("/forgot-password", forgotPasswordHandler);
router.post("/reset-password", resetPasswordHandler);

// Security & Session Routes
router.post("/refresh", refreshAccessToken);
router.post("/logout", logoutUser);

export default router;