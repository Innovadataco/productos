import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: ".env" });
config({ path: ".env.local" });

const prisma = new PrismaClient();

async function main() {
    const docId = "cmrdym5hh0004h19o3smr1ipd";
    const doc = await prisma.documentoOficial.findUnique({ where: { id: docId } });
    console.log("Status:", doc?.status);
    console.log("Error:", doc?.processingError || "Ninguno");
    console.log("Resumen:", doc?.resumen?.slice(0, 100) || "Ninguno");
    console.log("Actores:", doc?.actores?.slice(0, 100) || "Ninguno");
    await prisma["$disconnect"]();
}

main();