import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/db";

const generateTokens = (userId: string) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET as string,
    { expiresIn: "15m" }, // Access token 15 min
  );

  const refreshToken = jwt.sign(
    { userId },
    (process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET) as string,
    { expiresIn: "7d" }, // Refresh token 7 din
  );

  return { accessToken, refreshToken };
};

// 🛡️ NAYA: Cookie Set karne ka enterprise helper
const setRefreshTokenCookie = (res: Response, token: string) => {
  res.cookie("refreshToken", token, {
    httpOnly: true, // Frontend JS can't access it (XSS protection)
    secure: process.env.NODE_ENV === "production", // Prod mein HTTPS lazmi
    sameSite: "lax", // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  });
};

export const registerUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // ... validation and DB insert logic same as before ...
    const { email, name, password } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: { email, name, password: hashedPassword },
    });

    const { accessToken, refreshToken } = generateTokens(newUser.id);

    // Refresh token cookie mein set karo
    setRefreshTokenCookie(res, refreshToken);

    // Response mein sirf Access Token aur User data bhejo
    res.status(201).json({
      message: "User registered successfully",
      accessToken,
      user: { id: newUser.id, name: newUser.name, email: newUser.email },
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error." });
  }
};

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }

    const { accessToken, refreshToken } = generateTokens(user.id);

    // Refresh token cookie mein set karo
    setRefreshTokenCookie(res, refreshToken);

    // Response mein sirf Access Token bhejo
    res.status(200).json({
      message: "Login successful",
      accessToken,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ error: "Server error." });
  }
};

export const refreshAccessToken = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // 🛡️ NAYA: Body ke bajaye Cookie se token uthao
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      res.status(401).json({ error: "Refresh token is missing" });
      return;
    }

    const decoded = jwt.verify(
      refreshToken,
      (process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET) as string,
    ) as { userId: string };

    // Naya 15 min wala access token banao
    const accessToken = jwt.sign(
      { userId: decoded.userId },
      process.env.JWT_SECRET as string,
      { expiresIn: "15m" },
    );

    res.status(200).json({ accessToken });
  } catch (error) {
    console.error("❌ Invalid or Expired Refresh Token");
    // Security: Agar cookie invalid ho toh usay clear bhi kar do
    res.clearCookie("refreshToken");
    res
      .status(403)
      .json({ error: "Invalid refresh token. Please login again." });
  }
};

// 🛡️ NAYA: Logout controller (Taake cookie clear ho jaye)
export const logoutUser = async (
  req: Request,
  res: Response,
): Promise<void> => {
  res.clearCookie("refreshToken");
  res.status(200).json({ message: "Logged out successfully" });
};
