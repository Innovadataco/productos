/**
 * Construye lotes y asignaciones FIFO desde las órdenes importadas (INV-SPEC-12).
 *   npm run lotes:construir                    construye y guarda
 *   npm run lotes:construir -- --ensayo        lo mismo en una transacción que se deshace: no guarda nada
 *   npm run lotes:construir -- --ayuda         uso
 * Idempotente. Lee los argumentos antes de abrir la base (D1). Imprime solo conteos, códigos e ids internos.
 * Salida: 0 sin avisos · 3 con avisos · 2 uso · 1 error.
 */
import { PrismaClient } from "@prisma/client";
import { ErrorArgumentosConstruir, leerArgumentosConstruir, USO_CONSTRUIR, type ArgumentosConstruir } from "../src/lotes/argumentos";
import { construirLotes } from "../src/lotes/construir";
import { reporteConstruccion } from "../src/lotes/reporte";

function argumentos(): ArgumentosConstruir | null {
  try {
    return leerArgumentosConstruir(process.argv.slice(2), process.env);
  } catch (e) {
    if (!(e instanceof ErrorArgumentosConstruir)) throw e;
    console.error(`❌ ${e.message}\n${USO_CONSTRUIR}`);
    return null;
  }
}

async function main(): Promise<number> {
  const a = argumentos();
  if (a === null) return 2;
  if (a.ayuda) {
    console.log(USO_CONSTRUIR);
    return 0;
  }
  const db = new PrismaClient();
  try {
    const reporte = reporteConstruccion(await construirLotes(db, { ensayo: a.ensayo }));
    for (const linea of reporte.lineas) console.log(linea);
    return reporte.codigoSalida;
  } catch (e) {
    console.error(`❌ No se construyeron los lotes: ${e instanceof Error ? e.name : "error"}`);
    return 1;
  } finally {
    await db.$disconnect();
  }
}

// exitCode y no exit(): en macOS stdout por tubería es asíncrono y exit() podría cortar el reporte.
main().then(
  (codigo) => {
    process.exitCode = codigo;
  },
  (e: unknown) => {
    console.error(`❌ No se construyeron los lotes: ${e instanceof Error ? e.name : "error"}`);
    process.exitCode = 1;
  },
);
