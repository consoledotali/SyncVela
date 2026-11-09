import { Request } from "express";
import { Socket } from "socket.io";
import { User } from "@prisma/client";

export interface JwtPayload {
  userId: string;
  jti?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type SafeUser = Omit<
  User,
  | "password"
  | "refreshToken"
  | "resetToken"
  | "resetTokenExpiresAt"
  | "verificationToken"
  | "verificationExpiresAt"
  | "createdAt"
  | "updatedAt"
  | "googleId"
> & { hasPassword: boolean };

export interface AuthResponse {
  user: SafeUser;
  tokens: AuthTokens;
}

