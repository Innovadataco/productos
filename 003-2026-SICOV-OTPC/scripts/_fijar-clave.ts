// Helper SOLO para el guion de verificación: fija una clave conocida a un usuario y limpia
// claveTemporal, para poder autenticar en el smoke test (en producción la temporal va por correo).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const [identificacion, clave] = process.argv.slice(2);

async function main() {
  if (!identificacion || !clave) throw new Error("uso: _fijar-clave.ts <identificacion> <clave>");
  await prisma.usuario.updateMany({
    where: { identificacion },
    data: { clave: await bcrypt.hash(clave, 12), claveTemporal: false },
  });
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
