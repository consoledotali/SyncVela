import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL?.trim();

export const redisClient = redisUrl
  ? createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy(retries) {
          const maxDelayMs = 5_000;
          return Math.min(250 * 2 ** Math.min(retries, 5), maxDelayMs);
        },
      },
    })
  : null;

let connectionPromise: Promise<boolean> | null = null;

if (redisClient) {
  redisClient.on("error", (error) => {
    console.error("[redis] client error", error);
  });
}

export async function connectRedis(): Promise<boolean> {
  if (!redisClient) return false;
  if (redisClient.isReady) return true;
  if (connectionPromise) return connectionPromise;

  connectionPromise = redisClient
    .connect()
    .then(() => redisClient.isReady)
    .catch((error) => {
      console.error("[redis] unavailable", error);
      return false;
    })
    .finally(() => {
      connectionPromise = null;
    });

  return connectionPromise;
}

/**
 * Used by Redis-backed middleware during module initialization. It guarantees
 * that the first command is never sent through a closed client and that
 * concurrent initializers share one connection attempt.
 */
export async function ensureRedisReady(): Promise<boolean> {
  return connectRedis();
}

export async function disconnectRedis(): Promise<void> {
  if (!redisClient || !redisClient.isOpen) return;
  await redisClient.quit();
}

export function isRedisConfigured(): boolean {
  return Boolean(redisUrl);
}

export function isRedisReady(): boolean {
  return Boolean(redisClient?.isReady);
}

export function requireRedisInProduction(): void {
  if (process.env.NODE_ENV === "production" && !redisUrl) {
    throw new Error("REDIS_URL is required in production.");
  }
}
