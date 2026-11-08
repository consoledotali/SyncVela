import { Request } from "express";
import { Socket } from "socket.io";

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

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

