import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/db";
import { User } from "@prisma/client";
import crypto from "crypto";
import { validateEnterpriseEmail } from "../utils/emailValidator";
import { sendOtpEmail, sendPasswordResetOtpEmail } from "./emailService";
import { OAuth2Client } from "google-auth-library";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  userId: string;
}

export type SafeUser = Omit<User, "password" | "refreshToken">;

export interface AuthResponse {
  user: SafeUser;
  tokens: AuthTokens;
}

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const sanitizeUser = (user: User): SafeUser => {
  const { password, refreshToken, ...safeUser } = user;
  return safeUser;
};

export const generateAndStoreTokens = async (
  userId: string,
): Promise<AuthTokens> => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET as string, {
    expiresIn: "15m",
  });
  const refreshToken = jwt.sign(
    { userId },
    (process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET) as string,
    { expiresIn: "7d" },
  );

  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken },
  });

  return { accessToken, refreshToken };
};

// 🛡️ MODIFIED: Register strictly generates OTP and returns NO TOKENS yet.
export const register = async (
  email: string,
  name: string,
  password: string,
) => {
  await validateEnterpriseEmail(email);

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new Error("Email already in use");

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Generate 6-digit numerical OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  const verificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  const newUser = await prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      isEmailVerified: false,
      verificationToken: otp,
      verificationExpiresAt,
    },
  });

  sendOtpEmail(newUser.email, otp).catch((e) =>
    console.error("❌ Email failed to send:", e),
  );

  return {
    userId: newUser.id,
    email: newUser.email,
    message: "OTP sent to email",
  };
};

// 🛡️ NAYA: Verify OTP and dispense tokens
export const verifyOTP = async (
  email: string,
  otp: string,
): Promise<AuthResponse> => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) throw new Error("User not found");
  if (user.isEmailVerified) throw new Error("Email is already verified");

  if (user.verificationToken !== otp) throw new Error("Invalid OTP");
  if (user.verificationExpiresAt && new Date() > user.verificationExpiresAt) {
    throw new Error("OTP has expired. Please request a new one.");
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      isEmailVerified: true,
      verificationToken: null,
      verificationExpiresAt: null,
    },
  });

  const tokens = await generateAndStoreTokens(updatedUser.id);
  return { user: sanitizeUser(updatedUser), tokens };
};

export const login = async (
  email: string,
  password: string,
): Promise<AuthResponse> => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password!))) {
    throw new Error("Invalid credentials");
  }

  // 🛡️ STRICT GATEKEEPER
  if (!user.isEmailVerified) {
    throw new Error("EMAIL_NOT_VERIFIED");
  }

  const tokens = await generateAndStoreTokens(user.id);
  return { user: sanitizeUser(user), tokens };
};

export const googleLogin = async (idToken: string): Promise<AuthResponse> => {
  // 1. Token verify karo Google ke servers se
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload) throw new Error("Invalid Google Token");

  const { email, name, sub: googleId, picture } = payload;
  if (!email || !name) throw new Error("Incomplete Google Profile");

  let user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    // Agar user ne pehle Email/OTP se account banaya tha, toh ab account merge kar do
    if (!user.googleId) {
      user = await prisma.user.update({
        where: { email },
        data: {
          googleId,
          isEmailVerified: true, // Google accounts pehle se verified hote hain
          avatarUrl: user.avatarUrl || picture,
        },
      });
    }
  } else {
    // Naya user seedha Google se register ho raha hai
    user = await prisma.user.create({
      data: {
        email,
        name,
        provider: "GOOGLE",
        googleId,
        isEmailVerified: true,
        avatarUrl: picture,
      },
    });
  }

  const tokens = await generateAndStoreTokens(user.id);
  return { user: sanitizeUser(user), tokens };
};

export const refresh = async (
  incomingRefreshToken: string,
): Promise<{ accessToken: string }> => {
  const decoded = jwt.verify(
    incomingRefreshToken,
    (process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET) as string,
  ) as JwtPayload;

  const user = await prisma.user.findFirst({
    where: { id: decoded.userId, refreshToken: incomingRefreshToken },
  });

  if (!user) throw new Error("Refresh token revoked or invalid");

  const accessToken = jwt.sign(
    { userId: user.id },
    process.env.JWT_SECRET as string,
    { expiresIn: "15m" },
  );

  return { accessToken };
};

export const logout = async (userId: string): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken: null },
  });
};

export const requestPasswordReset = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("If this email exists, an OTP has been sent."); // Security trick: Don't reveal if email exists

  if (user.provider === "GOOGLE") {
    throw new Error(
      "This account uses Google Auth. You cannot reset its password here.",
    );
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken: otp, resetTokenExpiresAt },
  });

  sendPasswordResetOtpEmail(user.email, otp).catch((e) =>
    console.error("Email failed:", e),
  );

  return { message: "OTP sent to email" };
};

export const executePasswordReset = async (
  email: string,
  otp: string,
  newPassword: string,
) => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) throw new Error("Invalid request");
  if (user.resetToken !== otp) throw new Error("Invalid OTP");
  if (user.resetTokenExpiresAt && new Date() > user.resetTokenExpiresAt) {
    throw new Error("OTP has expired. Please request a new one.");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiresAt: null,
    },
  });

  return {
    message: "Password has been successfully reset. You can now login.",
  };
};
