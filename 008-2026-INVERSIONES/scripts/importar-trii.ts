/**
 * Carga local de los CSV de Trii (INV-SPEC-8).
 *   npm run importar:trii -- --email <correo-del-dueño> <archivo.csv> [<archivo.csv> …]
 * Usa DATABASE_URL (la base de 008). Imprime solo conteos y códigos de error, nunca valores.
 * Guarda solo el nombre del archivo, no su ruta ni su contenido original.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { importarArchivoTrii } from "../src/importacion/trii/importar";

const MAX_BYTES = 5 * 1024 * 1024;

function leerArgumentos(argv: readonly string[]): { email: string; archivos: string[] } {
  const i = argv.indexOf("--email");
  const email = i >= 0 ? argv[i + 1] : undefined;
  const archivos = argv.filter((a, j) => j !== i && j !== i + 1 && !a.startsWith("--"));
  if (!email || archivos.length === 0) {
    console.error("Uso: npm run importar:trii -- --email <correo-del-dueño> <archivo.csv> [...]");
    process.exit(2);
  }
  return { email, archivos };
}

async function dueno(db: PrismaClient, email: string): Promise<string> {
  const usuario = await db.usuario.findUnique({ where: { email } });
  if (usuario) return usuario.id; // si no es DUENO activo, la importación lo rechaza
  return (await db.usuario.create({ data: { email, rol: "DUENO" } })).id;
}

async function main(): Promise<void> {
  const { email, archivos } = leerArgumentos(process.argv.slice(2));
  const db = new PrismaClient();
  let rechazados = 0;
  try {
    const usuarioId = await dueno(db, email);
    for (const ruta of archivos) {
      const nombre = basename(ruta);
      if (statSync(ruta).size > MAX_BYTES) {
        console.error(`❌ ${nombre}: pasa de 5 MB, no se importa.`);
        rechazados += 1;
        continue;
      }
      const r = await importarArchivoTrii(db, { nombreArchivo: nombre, contenido: readFileSync(ruta), usuarioId });
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
