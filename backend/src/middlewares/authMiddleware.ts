import { Request, Response, NextFunction } from "express";
import { Socket } from "socket.io";
import jwt, { TokenExpiredError } from "jsonwebtoken";

// ------------------------------------------------------
// 1. STRICT TYPE DEFINITIONS (Zero 'any' allowed)
// ------------------------------------------------------
export interface JwtPayload {
  userId: string;
}

// Express Request object ko strictly augment kiya (Type Overriding)
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

// ------------------------------------------------------
// 2. CORE ENGINE: Single Source of Truth
// ------------------------------------------------------
// Token verify karne ka logic strictly ek jagah band kar diya
const verifyAccessToken = (token: string): JwtPayload => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("FATAL: JWT_SECRET is missing in environment variables.");
  }
  return jwt.verify(token, secret) as JwtPayload;
};

// ------------------------------------------------------
// 3. HTTP API GATEKEEPER (Express)
// ------------------------------------------------------
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  try {
    const token =
      req.cookies?.accessToken || req.headers.authorization?.split(" ")[1];

    if (!token) {
      res.status(401).json({ error: "Access denied. Token missing." });
      return;
    }

    // Ab typescript rote ga nahi, kyunke humne Request interface augment kar diya hai
    req.user = verifyAccessToken(token);
    next();
  } catch (error) {
    // Frontend ko explicit reason dena zaroori hai taake wo Refresh Token hit kar sake
    if (error instanceof TokenExpiredError) {
      res.status(401).json({ error: "TOKEN_EXPIRED" });
    } else {
      res.status(401).json({ error: "Invalid token." });
    }
  }
};

// ------------------------------------------------------
// 4. WEBSOCKET GATEKEEPER (Socket.io)
// ------------------------------------------------------
export const socketAuthMiddleware = (
  socket: AuthenticatedSocket,
  next: (err?: Error) => void,
) => {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.headers?.authorization?.split(" ")[1];

  if (!token) {
    console.error(`❌ Socket Rejected: No token provided (ID: ${socket.id})`);
    return next(new Error("Authentication error: Token missing"));
  }

  try {
    socket.user = verifyAccessToken(token); // Using the same core engine
    console.log(
      `✅ Socket Authenticated: User ${socket.user.userId} connected`,
    );
    next();
  } catch (error) {
    console.error(
      `❌ Socket Rejected: Invalid/Expired token (ID: ${socket.id})`,
    );
    return next(new Error("Authentication error: Invalid or expired token"));
  }
};
