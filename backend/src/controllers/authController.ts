import { Request, Response } from "express";
import * as authService from "../services/authService";

const setRefreshTokenCookie = (res: Response, token: string): void => {
  const sameSite = process.env.COOKIE_SAME_SITE === "none" ? "none" : "lax";
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || sameSite === "none",
    sameSite,
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const clearRefreshTokenCookie = (res: Response): void => {
  const sameSite = process.env.COOKIE_SAME_SITE === "none" ? "none" : "lax";
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || sameSite === "none",
    sameSite,
    path: "/api/auth",
  });
};

export const registerUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email, name, password } = req.body;
    const response = await authService.register(email, name, password);

    res.status(201).json({
      message: "Registration successful. Please verify OTP.",
      email: response.email,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error.";
    res.status(400).json({ error: errorMessage });
  }
};

export const resendOtpHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Email is required." });
      return;
    }
    const response = await authService.resendOtp(email);
    res.status(200).json(response);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to resend code.";
    res.status(400).json({ error: errorMessage });
  }
};

export const verifyOTPHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email, otp } = req.body;
    const { user, tokens } = await authService.verifyOTP(email, otp);

    setRefreshTokenCookie(res, tokens.refreshToken);

    res.status(200).json({
      message: "Email verified and logged in successfully",
      accessToken: tokens.accessToken,
      user,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Verification failed.";
    res.status(400).json({ error: errorMessage });
  }
};

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const { user, tokens } = await authService.login(email, password);

    setRefreshTokenCookie(res, tokens.refreshToken);

    res.status(200).json({
      message: "Login successful",
      accessToken: tokens.accessToken,
      user,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Invalid credentials.";
    const fallbackEmail = req.body?.email;

    if (errorMessage === "EMAIL_NOT_VERIFIED") {
      res.status(403).json({ error: errorMessage, email: fallbackEmail });
      return;
    }

    // 🚀 ACCOUNT LINKING: Google-only account tried email+password login.
    if (errorMessage === "GOOGLE_ACCOUNT") {
      res.status(403).json({ error: errorMessage, email: fallbackEmail });
      return;
    }

    res.status(401).json({ error: errorMessage });
  }
};

export const googleLoginHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      res.status(400).json({ error: "Google ID Token is required" });
      return;
    }

    const { user, tokens } = await authService.googleLogin(idToken);
    setRefreshTokenCookie(res, tokens.refreshToken);

    res.status(200).json({
      message: "Google login successful",
      accessToken: tokens.accessToken,
      user,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Google Authentication failed";
    console.error("❌ Google Auth Error:", errorMessage);
    res.status(401).json({ error: errorMessage });
  }
};

export const refreshAccessToken = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const refreshToken = req.cookies?.refreshToken as string | undefined;

    if (!refreshToken) {
      res.status(401).json({ error: "Refresh token is missing" });
      return;
    }

    const {
      user,
      tokens: { accessToken, refreshToken: rotatedRefreshToken },
    } = await authService.refresh(refreshToken);
    setRefreshTokenCookie(res, rotatedRefreshToken);

    // Access tokens remain memory-only. The HttpOnly refresh cookie restores
    // both the token and safe user profile after a hard browser refresh.
    res.status(200).json({ accessToken, user });
  } catch (error: unknown) {
    clearRefreshTokenCookie(res);
    res
      .status(403)
      .json({ error: "Invalid refresh token. Please login again." });
  }
};

export const logoutUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    if (refreshToken) {
      await authService.revokeRefreshToken(refreshToken);
    }

    clearRefreshTokenCookie(res);
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error: unknown) {
    res.status(500).json({ error: "Logout failed" });
  }
};

export const forgotPasswordHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email } = req.body;
    await authService.requestPasswordReset(email);
    res
      .status(200)
      .json({ message: "If this email exists, an OTP has been sent." });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const resetPasswordHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email, otp, newPassword } = req.body;
    const response = await authService.executePasswordReset(
      email,
      otp,
      newPassword,
    );
    res.status(200).json(response);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

// 🚀 ACCOUNT LINKING: authenticated Google user requests an OTP to set a password.
export const requestSetPasswordHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const response = await authService.requestSetPassword(userId);
    res.status(200).json(response);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const confirmSetPasswordHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { otp, newPassword } = req.body;
    if (!otp || !newPassword || newPassword.length < 6) {
      res
        .status(400)
        .json({ error: "OTP and a password (min 6 chars) are required." });
      return;
    }
    const response = await authService.confirmSetPassword(
      userId,
      otp,
      newPassword,
    );
    res.status(200).json(response);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};
