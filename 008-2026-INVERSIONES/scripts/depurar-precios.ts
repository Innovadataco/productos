/**
 * Depura los cierres de Yahoo ya guardados de días no hábiles o sin negociación (SPEC-13).
 *   npm run precios:depurar -- --desde AAAA-MM-DD [--hasta AAAA-MM-DD]                    ensayo: solo conteos
 *   npm run precios:depurar -- --desde AAAA-MM-DD --aplicar --base <nombre-de-la-base>    retira (reemplazadoEn)
 * Pide a Yahoo el volumen de las especies con cierres vigentes en el rango (servicio externo: solo desde la
 * máquina del dueño o el servidor). Imprime conteos, códigos, ids internos y el nombre de la base; nunca
 * precios ni nemotécnicos. Salida: 0 sin avisos · 3 con avisos · 2 uso · 1 error.
 */
import { PrismaClient } from "@prisma/client";
import { ErrorArgumentosDepurar, leerArgumentosDepurar, USO_DEPURAR, type ArgumentosDepurar } from "../src/precios/argumentos-depurar";
import { depurarPrecios } from "../src/precios/depurar";
import { fechaEnBogota } from "../src/precios/horario";
import { reporteDepuracion } from "../src/precios/reporte";

async function main(): Promise<number> {
  let a: ArgumentosDepurar;
  try {
    a = leerArgumentosDepurar(process.argv.slice(2), fechaEnBogota(new Date()));
  } catch (e) {
    if (!(e instanceof ErrorArgumentosDepurar)) throw e;
    console.error(`❌ ${e.message}\n${USO_DEPURAR}`);
    return 2;
  }
  const db = new PrismaClient();
  try {
    const reporte = reporteDepuracion(await depurarPrecios(db, { ...a, buscar: fetch }));
    for (const linea of reporte.lineas) console.log(linea);
    return reporte.codigoSalida;
  } finally {
    await db.$disconnect();
  }
}

main()
  .then((codigo) => process.exit(codigo))
  .catch((e: unknown) => {
    // Solo el código de los errores propios (fijo y sin valores); de los demás, solo el nombre.
    const codigo = e instanceof Error && e.name === "ErrorDepuracion" ? ` (${String((e as { codigo?: unknown }).codigo)})` : "";
    console.error(`❌ La depuración falló: ${e instanceof Error ? e.name : "error"}${codigo}`);
    process.exit(1);
  });
