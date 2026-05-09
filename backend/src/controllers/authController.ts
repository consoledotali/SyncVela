import { Request, Response } from "express";
import * as authService from "../services/authService";

const setRefreshTokenCookie = (res: Response, token: string): void => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

export const registerUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { email, name, password } = req.body;

    // Notice: Tokens nahi aa rahe yahan ab
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

    // 🛡️ THE FIX: Catch block mein email dobara req.body se nikalo kyunke try block wala yahan expire ho chuka hai.
    const fallbackEmail = req.body?.email;

    // Frontend ko pata chalega ke isey OTP screen par bhejna hai
    if (errorMessage === "EMAIL_NOT_VERIFIED") {
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
  console.log("🛠️ --- DEBUG: REFRESH API HIT ---");
  try {
    const refreshToken = req.cookies?.refreshToken as string | undefined;

    if (!refreshToken) {
      res.status(401).json({ error: "Refresh token is missing" });
      return;
    }

    const { accessToken } = await authService.refresh(refreshToken);
    res.status(200).json({ accessToken });
  } catch (error: unknown) {
    res.clearCookie("refreshToken");
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
      const jwt = require("jsonwebtoken");
      const decoded = jwt.decode(refreshToken) as authService.JwtPayload | null;
      if (decoded?.userId) {
        await authService.logout(decoded.userId);
      }
    }

    res.clearCookie("refreshToken");
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
