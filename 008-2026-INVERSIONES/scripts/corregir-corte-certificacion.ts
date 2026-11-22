/**
 * Corrige el corte de una certificación de A&V ya cargada con el corte equivocado (frente certificacion-corte-real).
 *   npx tsx scripts/corregir-corte-certificacion.ts --email <correo-del-dueño> --fecha-corte AAAA-MM-DD --nueva-fecha-corte AAAA-MM-DD <certificacion.pdf>
 * - `--fecha-corte`: el corte con que se cargó; `--nueva-fecha-corte`: el corte real (lo sugieren la importación,
 *   con CORTE_NO_COINCIDE o FECHA_CORTE_ANTES_DEL_CIERRE, y la conciliación, con fecha_corte_dudosa). Nunca se infiere.
 * - El PDF debe ser el MISMO archivo que se cargó (mismo sha256). El fondo ya quedó vinculado: no lleva --fondo.
 * - En una sola transacción: retira la certificación vieja (no se borra: queda como historia, con su carga en REVERTIDO
 *   y sus conciliaciones), la importa con el corte real por el camino de siempre y re-verifica los cierres de los dos
 *   días. Si algo no cuadra, no cambia nada (queda una carga RECHAZADO con el código).
 * - Siguiente paso: `npx tsx scripts/conciliar-certificacion.ts --fecha-corte <corte real>`. En producción
 *   (NODE_ENV=production), por `cargar-prod.sh corregir-corte-certificacion` y `cargar-prod.sh conciliar-certificacion`.
 * Usa DATABASE_URL (la base de 008) y las claves de cifrado del entorno. Imprime solo conteos, códigos y las fechas que
 * usted dio; nunca montos, especies, cuentas ni el correo. Sale con 0 si corrigió, 1 si no y 2 con argumentos inválidos.
 */
import { PrismaClient } from "@prisma/client";
import { ErrorArgumentosAv, leerArgumentosCorregir, type ArgumentosCorregirCorte } from "../src/importacion/av/argumentos";
import { corregirCorteCertificacion } from "../src/importacion/av/corregir";
import { isoDia } from "../src/importacion/av/fecha-corte";
import { MAX_BYTES } from "../src/importacion/av/importar";
import { lineasDeCorreccion } from "../src/importacion/av/salida";
import { leerArchivoAcotado } from "../src/lib/archivo-acotado";

const USO = "Uso: npx tsx scripts/corregir-corte-certificacion.ts --email <correo-del-dueño> --fecha-corte AAAA-MM-DD --nueva-fecha-corte AAAA-MM-DD <certificacion.pdf>";

function argumentos(): ArgumentosCorregirCorte {
  try {
    return leerArgumentosCorregir(process.argv.slice(2));
  } catch (e) {
    console.error(`❌ ${e instanceof ErrorArgumentosAv ? e.codigo : "ARGUMENTOS_INVALIDOS"}\n${USO}`);
    process.exit(2);
  }
}

function salir(mensaje: string): never {
  console.error(mensaje);
  process.exit(1);
}

/** El PDF de un archivo REGULAR, sin leer más del tope (un FIFO, un dispositivo o una carpeta no pasan ni cuelgan). */
function leerPdf(ruta: string): Uint8Array {
  const r = leerArchivoAcotado(ruta, MAX_BYTES);
  if (r.ok) return r.bytes;
  if (r.codigo === "ARCHIVO_DEMASIADO_GRANDE") return salir("❌ PDF_DEMASIADO_GRANDE · el archivo pasa de 15 MB y no se usa.");
  return salir("❌ ARCHIVO_ILEGIBLE · no se pudo leer el PDF indicado.");
}

async function main(): Promise<void> {
  const a = argumentos();
  const contenido = leerPdf(a.archivo);
  const db = new PrismaClient();
  try {
    const usuario = await db.usuario.findUnique({ where: { email: a.email }, select: { id: true } });
    if (!usuario) return salir("❌ USUARIO_NO_REGISTRADO · ese correo no está registrado (este comando no crea usuarios).");
    const r = await corregirCorteCertificacion(db, { contenido, usuarioId: usuario.id, fechaCorte: a.fechaCorte, nuevaFechaCorte: a.nuevaFechaCorte });
    // La imagen del migrador trae NODE_ENV=production: allí el siguiente paso va por cargar-prod.sh (vía B).
    for (const linea of lineasDeCorreccion(r, isoDia(a.fechaCorte), isoDia(a.nuevaFechaCorte), process.env.NODE_ENV === "production")) console.log(linea);
    process.exitCode = r.estado === "CORREGIDO" ? 0 : 1;
  } finally {
    await db.$disconnect();
  }
}

main().catch((e: unknown) => {
  const codigo = e instanceof Error && "codigo" in e ? ` (${String((e as { codigo: unknown }).codigo)})` : "";
  console.error(`❌ La corrección falló: ${e instanceof Error ? e.name : "error"}${codigo}`);
  process.exit(1);
});
