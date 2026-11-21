/**
 * Acceso inicial y recuperación del login de Inversiones (D-014). Lo corre Jelk, no la Fábrica:
 *   npx tsx scripts/crear-acceso-inicial.ts --email <correo>
 * Crea el dueño sin contraseña (o reutiliza el que hay) e imprime UNA vez un enlace de un solo uso,
 * `${APP_ORIGEN}/definir-clave#t=<token>`, que vence en 30 minutos. Si se pierde la contraseña, el mismo
 * comando da un enlace de recuperación. Usa DATABASE_URL, y APP_ORIGEN con NODE_ENV=production.
 * En producción corre en la imagen del migrador (el `.sh` que lo envuelve es del frente de producción).
 */
import { PrismaClient } from "@prisma/client";
import { ejecutar } from "../src/auth/acceso-cli";

const db = new PrismaClient();

ejecutar(process.argv.slice(2), { salida: process.stdout, error: process.stderr }, db, process.env)
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch(() => {
    process.stderr.write("❌ Error inesperado.\n");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
