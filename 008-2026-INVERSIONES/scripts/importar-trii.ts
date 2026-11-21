/**
 * Carga local de los CSV de Trii (INV-SPEC-8).
 *   npm run importar:trii -- --email <correo-del-dueño> <archivo.csv> [<archivo.csv> …]
 *   La primera vez, con la base vacía: agregue --crear-dueno (solo funciona si aún no hay ningún dueño).
 * Usa DATABASE_URL (la base de 008). Imprime solo conteos y códigos de error, nunca valores.
 * Guarda solo el nombre del archivo, no su ruta ni su contenido original.
 * Antes de abrir la base (O1): argumentos estrictos (src/cli/argumentos-importar-trii.ts) y la lectura de cada
 * archivo (que exista, sea un archivo y se pueda leer; si no, sale con 2 sin tocar nada). Uno de más de 5 MB no
 * se lee y se rechaza (salida 1); si no queda ninguno para importar, no se abre la base: nunca crea el dueño de
 * un comando que no iba a importar nada.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, statSync, type Stats } from "node:fs";
import { basename } from "node:path";
import { ErrorArgumentosImportarTrii, USO_IMPORTAR_TRII, leerArgumentosImportarTrii, type ArgumentosImportarTrii } from "../src/cli/argumentos-importar-trii";
import { importarArchivoTrii, MAX_BYTES } from "../src/importacion/trii/importar";

function salirPorUso(mensaje: string, conUso: boolean): never {
  console.error(`❌ ${mensaje}${conUso ? `\n${USO_IMPORTAR_TRII}` : ""}`);
  process.exit(2);
}

function leerArgumentos(): ArgumentosImportarTrii {
  try {
    return leerArgumentosImportarTrii(process.argv.slice(2), process.env);
  } catch (e) {
    if (e instanceof ErrorArgumentosImportarTrii) salirPorUso(e.message, true);
    throw e;
  }
}

/** Un archivo ya leído; `contenido` es null si pasa de 5 MB (no se lee). */
interface ArchivoLeido {
  readonly nombre: string;
  readonly contenido: Buffer | null;
}

/** Cualquier fallo al mirarlo (no existe, una carpeta en la ruta) cuenta como «no existe o no es un archivo». */
function mirar(ruta: string): Stats | null {
  try {
    return statSync(ruta);
  } catch {
    return null;
  }
}

/** Lee todo antes de abrir la base. Un archivo se nombra por su posición, nunca por su nombre o su ruta. */
function leerArchivos(rutas: readonly string[]): ArchivoLeido[] {
  return rutas.map((ruta, i) => {
    const cual = `El archivo ${i + 1} de ${rutas.length}`;
    const info = mirar(ruta);
    if (!info?.isFile()) salirPorUso(`${cual} no existe o no es un archivo. No se tocó la base.`, false);
    if (info.size > MAX_BYTES) return { nombre: basename(ruta), contenido: null };
    try {
      return { nombre: basename(ruta), contenido: readFileSync(ruta) };
    } catch {
      return salirPorUso(`${cual} no se pudo leer. No se tocó la base.`, false);
    }
  });
}

/** Nunca crea un dueño en silencio: un error de tipeo en el correo no debe dar acceso total. */
async function dueno(db: PrismaClient, email: string, crearDueno: boolean): Promise<string> {
  const usuario = await db.usuario.findUnique({ where: { email } });
  if (usuario) return usuario.id; // si no es DUENO activo, la importación lo rechaza
  if (!crearDueno) {
    console.error("❌ Ese correo no está registrado. Si es la primera carga, repita con --crear-dueno.");
    process.exit(2);
  }
  if ((await db.usuario.count({ where: { rol: "DUENO" } })) > 0) {
    console.error("❌ Ya hay un dueño registrado con otro correo: revise --email. No se crea otro.");
    process.exit(2);
  }
  return (await db.usuario.create({ data: { email, rol: "DUENO" } })).id;
}

async function main(): Promise<void> {
  const { email, archivos, crearDueno } = leerArgumentos();
  const leidos = leerArchivos(archivos);
  const grandes = leidos.filter((a) => a.contenido === null);
  for (const { nombre } of grandes) console.error(`❌ ${nombre}: pasa de 5 MB, no se importa.`);
  const importables = leidos.flatMap(({ nombre, contenido }) => (contenido ? [{ nombre, contenido }] : []));
  if (importables.length === 0) process.exit(1); // nada que importar: ni se abre la base ni se crea el dueño
  let rechazados = grandes.length;
  const db = new PrismaClient();
  try {
    const usuarioId = await dueno(db, email, crearDueno);
    if ((await db.eventoCorporativo.count()) === 0) {
      console.log("ℹ️  No hay eventos de escisión registrados: un pago de fracción en el CSV de dividendos quedará como dividendo ordinario (para corregirlo habrá que revertir esa carga).");
    }
    for (const { nombre, contenido } of importables) {
      const r = await importarArchivoTrii(db, { nombreArchivo: nombre, contenido, usuarioId });
      if (r.estado === "CARGADO") {
        console.log(`✅ ${nombre} · ${r.tipo} · ${r.filasTotal} filas: ${r.filasNuevas} nuevas, ${r.filasRepetidas} repetidas, ${r.instrumentosCreados} instrumentos nuevos`);
      } else {
        rechazados += 1;
        console.log(`❌ ${nombre} · RECHAZADO (nada se guardó) · ${r.errores.length} error(es):`);
        for (const e of r.errores) console.log(`   fila ${e.fila}${e.columna ? ` · ${e.columna}` : ""} · ${e.codigo}`);
      }
    }
  } finally {
    await db.$disconnect();
  }
  process.exit(rechazados > 0 ? 1 : 0);
}

main().catch((e: unknown) => {
  console.error(`❌ La importación falló: ${e instanceof Error ? e.name : "error"}${e instanceof Error && "codigo" in e ? ` (${String((e as { codigo: unknown }).codigo)})` : ""}`);
  process.exit(1);
});
