import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../config/db";
import { User } from "@prisma/client";

// ==========================================
// STRICT TYPES & INTERFACES
// ==========================================
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  userId: string;
}

// THE SHIELD: Password ko type se aur object se bahar nikalne ka tareeqa
export type SafeUser = Omit<User, "password">;

export interface AuthResponse {
  user: SafeUser;
  tokens: AuthTokens;
}

// ==========================================
// HELPERS
// ==========================================
const sanitizeUser = (user: User): SafeUser => {
  const { password, ...safeUser } = user;
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

  // DB strict update
  await prisma.user.update({
    where: { id: userId },
    data: { refreshToken },
  });

  return { accessToken, refreshToken };
};

// ==========================================
// BUSINESS LOGIC
// ==========================================
export const register = async (
  email: string,
  name: string,
  password: string,
): Promise<AuthResponse> => {
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new Error("Email already in use");

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = await prisma.user.create({
    data: { email, name, password: hashedPassword },
  });

  const tokens = await generateAndStoreTokens(newUser.id);
  return { user: sanitizeUser(newUser), tokens };
};

export const login = async (
  email: string,
  password: string,
): Promise<AuthResponse> => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new Error("Invalid credentials");
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
