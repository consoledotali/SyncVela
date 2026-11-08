import { Request, Response, NextFunction } from "express";
import { Socket } from "socket.io";
import jwt, { TokenExpiredError } from "jsonwebtoken";

export interface JwtPayload {
  userId: string;
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

const verifyAccessToken = (token: string): JwtPayload => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("FATAL: JWT_SECRET is missing in environment variables.");
  }
  return jwt.verify(token, secret) as JwtPayload;
};

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

    req.user = verifyAccessToken(token);
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      res.status(401).json({ error: "TOKEN_EXPIRED" });
    } else {
      res.status(401).json({ error: "Invalid token." });
    }
  }
};

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
    socket.user = verifyAccessToken(token);
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
