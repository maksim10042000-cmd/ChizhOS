import { PrismaClient } from "@prisma/client";

/**
 * Singleton PrismaClient (переживает HMR в dev, один пул соединений в prod).
 * Используется при переходе data-слоя на PostgreSQL (см. src/lib/data/repo.ts).
 */
const g = globalThis as unknown as { __prisma?: PrismaClient };

export const prisma =
  g.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") g.__prisma = prisma;
