import { Router } from "express";
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  verifyOTPHandler,
  resendOtpHandler,
  googleLoginHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  requestSetPasswordHandler,
  confirmSetPasswordHandler,
} from "../controllers/authController";
import { authMiddleware } from "../middlewares/authMiddleware";
import {
  authOnboardingRateLimit,
  authSessionRateLimit,
  credentialRateLimit,
} from "../middlewares/rateLimit";

const router = Router();

router.post("/register", authOnboardingRateLimit, registerUser);
router.post("/login", credentialRateLimit, loginUser);
router.post("/verify-otp", authOnboardingRateLimit, verifyOTPHandler);
router.post("/resend-otp", authOnboardingRateLimit, resendOtpHandler);

router.post("/google", credentialRateLimit, googleLoginHandler);

router.post("/forgot-password", authOnboardingRateLimit, forgotPasswordHandler);
router.post("/reset-password", credentialRateLimit, resetPasswordHandler);

router.post(
  "/set-password/request",
  authOnboardingRateLimit,
  authMiddleware,
  requestSetPasswordHandler,
);
router.post(
  "/set-password/confirm",
  credentialRateLimit,
  authMiddleware,
  confirmSetPasswordHandler,
);

router.post("/refresh", authSessionRateLimit, refreshAccessToken);
router.post("/logout", authSessionRateLimit, logoutUser);

export default router;
