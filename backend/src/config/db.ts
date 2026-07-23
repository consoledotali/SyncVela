import { PrismaClient } from "@prisma/client";

// Global object mein prisma instance save karne ka pattern
// taake Next.js hot-reload par naye connections na khole
const prismaClientSingleton = () => {
  return new PrismaClient({
    // Only surface errors and warnings. Query-level logging is far too noisy
    // (every SQL statement prints) and can leak data — enable it ad hoc via
    // PRISMA_LOG_QUERIES=true when you actually need to debug a query.
    log:
      process.env.PRISMA_LOG_QUERIES === "true"
        ? ["query", "error", "warn"]
        : ["error", "warn"],
  });
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

// Agar purana connection maujood hai toh wo use karo, warna naya banao
const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

// Production mein global caching ki zaroorat nahi hoti, sirf development mein hoti hai
if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}