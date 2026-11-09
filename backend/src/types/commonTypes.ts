export interface AppError extends Error {
  statusCode?: number;
}

export interface RateLimitOptions {
  windowMs: number;
  limit: number;
  prefix: string;
  skipSuccessfulRequests?: boolean;
}

