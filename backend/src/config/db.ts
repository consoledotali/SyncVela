import { PrismaClient } from "@prisma/client";

// Global object mein prisma instance save karne ka pattern
// taake Next.js hot-reload par naye connections na khole
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
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