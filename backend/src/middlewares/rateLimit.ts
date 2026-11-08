import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { ensureRedisReady, redisClient } from "../config/redis";

type RateLimitOptions = {
  windowMs: number;
  limit: number;
  prefix: string;
  skipSuccessfulRequests?: boolean;
};

function createDistributedLimiter({
  windowMs,
  limit,
  prefix,
  skipSuccessfulRequests = false,
}: RateLimitOptions) {
  const client = redisClient;
  const store = client
    ? new RedisStore({
        prefix: `syncvela:ratelimit:${prefix}:`,
        sendCommand: async (...args: string[]) => {
          const ready = await ensureRedisReady();
          if (!ready) {
            throw new Error("Redis is unavailable for distributed rate limiting");
          }
          return client.sendCommand(args);
        },
      })
    : undefined;

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (_request, response, _next, options) => {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(options.windowMs / 1000),
      );
      response.status(options.statusCode).json({
        error: "Too many attempts. Please wait before trying again.",
        retryAfterSeconds,
      });
    },
    store,
    passOnStoreError: process.env.NODE_ENV !== "production",
  });
}

export const credentialRateLimit = createDistributedLimiter({
  prefix: "credential",
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
});

export const authOnboardingRateLimit = createDistributedLimiter({
  prefix: "onboarding",
  windowMs: 15 * 60 * 1000,
  limit: 15,
});

export const authSessionRateLimit = createDistributedLimiter({
  prefix: "session",
  windowMs: 60 * 1000,
  limit: 120,
});

export const uploadRateLimit = createDistributedLimiter({
  prefix: "upload",
  windowMs: 60 * 1000,
  limit: 60,
});

export const mutationRateLimit = createDistributedLimiter({
  prefix: "mutation",
  windowMs: 60 * 1000,
  limit: 120,
});
