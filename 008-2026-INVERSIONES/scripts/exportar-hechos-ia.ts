/**
 * El export de hechos del portafolio para la evaluación de la IA (E7), de SOLO LECTURA: lee la base con los lectores de
 * siempre en UNA transacción READ ONLY, arma los tres paquetes (DIARIO, REGLAS y ESCENARIOS) con los armadores de E1b
 * y los imprime como JSON por stdout (`exportacion-hechos-v1`, el que lee `ia:evaluar -- correr --paquetes`). No
 * escribe en la base ni en disco. Por stderr, solo conteos y códigos (nunca cifras ni nombres).
 * En producción va por la vía B, sin archivo ni opciones:
 *   scripts/armar-sobre.sh <cabecera vacía> | ssh <vps> <raíz>/repo/008-2026-INVERSIONES/scripts/cargar-prod.sh exportar-hechos-ia > <archivo.json>
 * Sus lectores importan "server-only": corre con `tsx --conditions=react-server` (así lo lanza inv-cargar).
 * Se niega a escribir en una terminal (el JSON trae cifras del portafolio). Rol: el del migrador; pasa a inv_ia cuando exista.
 * Salida: 0 los tres paquetes · 3 alguno quedó fuera (sale el resto) · 2 uso o terminal · 1 error o ninguno.
 */
import { PrismaClient } from "@prisma/client";
import { serializarExportacion } from "../src/ia/evaluacion/exportacion";
import { exportarHechos } from "../src/ia/evaluacion/exportar/exportar";
import { fechaEnBogota } from "../src/precios/horario";

function escribir(texto: string): Promise<void> {
  return new Promise((resolver, rechazar) => {
    process.stdout.write(texto, (error) => (error ? rechazar(error) : resolver()));
  });
}

async function main(): Promise<number> {
  if (process.argv.length > 2) {
    console.error("❌ USO · exportar-hechos-ia no lleva opciones ni archivo: imprime los tres paquetes por stdout.");
    return 2;
  }
  if (process.stdout.isTTY) {
    console.error("❌ SALIDA_TERMINAL · el JSON va a un archivo de una carpeta 700 (> …), nunca a la pantalla.");
    return 2;
  }
  const db = new PrismaClient();
  try {
    const r = await exportarHechos(db, fechaEnBogota(new Date(Date.now())));
    for (const o of r.omitidos) console.error(`⚠️  ${o.tipo} quedó fuera: ${o.codigo}`);
    for (const a of r.avisos) console.error(`⚠️  ${a}`);
    if (r.paquetes.length === 0) {
      console.error("❌ SIN_PAQUETES · no se pudo armar ningún paquete.");
      return 1;
    }
    await escribir(serializarExportacion(r.paquetes));
    console.error(`✅ ${r.paquetes.length} paquetes: ${r.paquetes.map((p) => `${p.tipo} ${p.hechos.length} hechos`).join(" · ")}`);
    return r.omitidos.length === 0 ? 0 : 3;
  } finally {
    await db.$disconnect();
  }
}

// Sin process.exit(): el JSON termina de escribirse antes de que el proceso acabe (un tubo es asíncrono).
main()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch((e: unknown) => {
    console.error(`❌ El export de hechos falló: ${e instanceof Error ? e.name : "error"}`);
    process.exitCode = 1;
  });
