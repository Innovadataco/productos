process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";
import { logger } from "./src/lib/queue.ts";
console.log("queue imported");
