import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  vetbridgePrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.vetbridgePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.vetbridgePrisma = prisma;
}

export * from "@prisma/client";
