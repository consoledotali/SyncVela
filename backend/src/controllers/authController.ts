import { Request, Response } from "express";
import * as authService from "../services/authService";

// Helper strictly typed
const setRefreshTokenCookie = (res: Response, token: string): void => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, 
  });
};

export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, name, password } = req.body;
    
    // Yahan ts ko pata hai ke authService.register strictly AuthResponse dega
    const { user, tokens } = await authService.register(email, name, password);

    setRefreshTokenCookie(res, tokens.refreshToken);

    res.status(201).json({
      message: "User registered successfully",
      accessToken: tokens.accessToken,
      user, // Sanitize ho kar aaya hai
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Email already in use") {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Internal server error." });
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
      user, // Sanitize ho kar aaya hai
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Invalid credentials.";
    res.status(401).json({ error: errorMessage });
  }
};

export const refreshAccessToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    
    if (!refreshToken) {
      res.status(401).json({ error: "Refresh token is missing" });
      return;
    }

    const { accessToken } = await authService.refresh(refreshToken);
    res.status(200).json({ accessToken });
  } catch (error: unknown) {
    console.error("❌ Invalid or Expired Refresh Token");
    res.clearCookie("refreshToken");
    res.status(403).json({ error: "Invalid refresh token. Please login again." });
  }
};

export const logoutUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    
    if (refreshToken) {
        const jwt = require("jsonwebtoken");
        // Strict generic casting for decode
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