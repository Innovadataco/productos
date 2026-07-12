import { execSync } from "child_process";

console.log("Running Prisma seed...");
execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });