import { PrismaClient } from "@prisma/client";
import { APIS } from "./catalogoApis.mjs";
import { config as loadEnv } from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Cargar variables de entorno (igual que scripts/worker.mjs)
const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, "../.env.local") });
loadEnv({ path: join(__dirname, "../.env") });


const prisma = new PrismaClient();

// El catálogo vive ahora en catalogoApis.mjs (fuente única, spec 004).

async function main() {
  await prisma.agentApi.deleteMany();
  await prisma.agentApi.createMany({ data: APIS });
  console.log(`Sembradas ${APIS.length} APIs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
