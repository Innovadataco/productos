import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
    log: process.env.DEMO_VERBOSE === "1" ? ["query", "error", "warn"] : ["error"],
});
