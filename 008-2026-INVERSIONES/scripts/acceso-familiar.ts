/**
 * El acceso de un familiar al login de Inversiones (frente familia-lectura): rol FAMILIA, solo lectura. Lo corre Jelk,
 * nunca la Fábrica (maneja accesos):
 *   npx tsx scripts/acceso-familiar.ts --email <correo>                   alta, o enlace de recuperación de la clave
 *   npx tsx scripts/acceso-familiar.ts --email <correo> --revocar         lo desactiva y cierra sus sesiones
 *   npx tsx scripts/acceso-familiar.ts --email <correo> --reiniciar-totp  borra su segundo factor (teléfono y códigos perdidos)
 * El alta imprime UNA vez `${APP_ORIGEN}/definir-clave#t=<token>&u=<correo>`, que vence en 30 minutos: se le entrega
 * al familiar en persona o por un canal cifrado. Usa DATABASE_URL, y APP_ORIGEN con NODE_ENV=production (solo para el
 * enlace). En producción corre en la imagen del migrador con inv_dueno, por scripts/acceso-familiar.sh.
 */
import { PrismaClient } from "@prisma/client";
import { ejecutar } from "../src/auth/familia-cli";

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
