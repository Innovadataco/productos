/**
 * Carga local de la certificación PDF de Acciones & Valores y su conciliación por fecha de corte (hito 1).
 *   npx tsx scripts/importar-certificacion.ts --email <correo-del-dueño> --fecha-corte AAAA-MM-DD [--fondo <codigoFic>] <certificacion.pdf>
 * - La fecha de corte es OBLIGATORIA: el texto del PDF no la trae y nunca se infiere. Debe ser día hábil de la BVC,
 *   no posterior a la fecha de generación del PDF y de hasta 7 días antes.
 * - `--fondo <codigoFic>` (el código de la SFC del fondo ya registrado con actualizar-fondo) solo hace falta la
 *   primera vez, para vincular el NIT del fondo que trae la certificación.
 * - El correo debe ser el de un DUENO ya registrado (este comando no crea usuarios).
 * - Al cargar, concilia y deja la conciliación guardada.
 * - Orden recomendado: importar la certificación y DESPUÉS traer los cierres de ese día con
 *   `npm run precios:actualizar -- --desde <corte>` (este comando no llama a la red; lo imprime como siguiente paso),
 *   y volver a conciliar con `npx tsx scripts/conciliar-certificacion.ts --fecha-corte <corte>`.
 * Usa DATABASE_URL (la base de 008) y las claves de cifrado del entorno. Imprime solo conteos, códigos y la fecha de
 * corte que usted dio; nunca montos, especies, cuentas ni el correo. El archivo original no se guarda.
 */
import { PrismaClient } from "@prisma/client";
import { closeSync, fstatSync, openSync, readSync } from "node:fs";
import { ErrorArgumentosAv, leerArgumentosImportar, type ArgumentosImportarCertificacion } from "../src/importacion/av/argumentos";
import { MAX_BYTES } from "../src/importacion/av/importar";
import { cargarYConciliar } from "../src/importacion/av/salida";

const USO = "Uso: npx tsx scripts/importar-certificacion.ts --email <correo-del-dueño> --fecha-corte AAAA-MM-DD [--fondo <codigoFic>] <certificacion.pdf>";

function argumentos(): ArgumentosImportarCertificacion {
  try {
    return leerArgumentosImportar(process.argv.slice(2));
  } catch (e) {
    console.error(`❌ ${e instanceof ErrorArgumentosAv ? e.codigo : "ARGUMENTOS_INVALIDOS"}\n${USO}`);
    process.exit(2);
  }
}

function salir(mensaje: string): never {
  console.error(mensaje);
  process.exit(1);
}

/** Lee como mucho `tope` bytes de un archivo REGULAR (un FIFO o un dispositivo no pasan); null si no se puede. */
function leerAcotado(ruta: string, tope: number): Uint8Array | null {
  let fd: number | null = null;
  try {
    fd = openSync(ruta, "r");
    if (!fstatSync(fd).isFile()) return null;
    const buffer = Buffer.alloc(tope);
    let leidos = 0;
    for (let n = 1; n > 0 && leidos < tope; leidos += n) n = readSync(fd, buffer, leidos, tope - leidos, null);
    return new Uint8Array(buffer.subarray(0, leidos));
  } catch {
    return null;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

function leerPdf(ruta: string): Uint8Array {
  const contenido = leerAcotado(ruta, MAX_BYTES + 1);
  if (contenido === null) return salir("❌ ARCHIVO_ILEGIBLE · no se pudo leer el PDF indicado.");
  if (contenido.byteLength > MAX_BYTES) return salir("❌ PDF_DEMASIADO_GRANDE · el archivo pasa de 15 MB y no se importa.");
  return contenido;
}

async function main(): Promise<void> {
  const a = argumentos();
  const contenido = leerPdf(a.archivo);
  const db = new PrismaClient();
  try {
    const usuario = await db.usuario.findUnique({ where: { email: a.email }, select: { id: true } });
    if (!usuario) return salir("❌ USUARIO_NO_REGISTRADO · ese correo no está registrado (este comando no crea usuarios).");
    const r = await cargarYConciliar(db, { contenido, usuarioId: usuario.id, fechaCorte: a.fechaCorte, fondoCodigo: a.fondo });
    for (const linea of r.lineas) console.log(linea);
    process.exitCode = r.codigo;
  } finally {
    await db.$disconnect();
  }
}

main().catch((e: unknown) => {
  const codigo = e instanceof Error && "codigo" in e ? ` (${String((e as { codigo: unknown }).codigo)})` : "";
  console.error(`❌ La importación falló: ${e instanceof Error ? e.name : "error"}${codigo}`);
  process.exit(1);
});
