/**
 * Importa la ficha de inversiones de ODIN al plan de Inversiones (D-013, paso 1).
 *   npx tsx scripts/importar-plan.ts --ficha <ruta.md> --email <correo-del-dueño> [--aplicar]
 * Sin --aplicar es un ensayo: lee la base y NO escribe. Con --aplicar escribe en la base de
 * DATABASE_URL (la del entorno o, si no está, la del .env). Reimportar la misma ficha no duplica nada.
 * Imprime solo conteos, códigos y números de línea: nunca especies, cifras ni textos de la ficha.
 * Salida: 0 bien · 1 bloqueado o a mitad · 2 uso o archivo · 3 otra importación en curso.
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { leerArgumentos } from "../src/plan/importar/argumentos";
import { importarFicha } from "../src/plan/importar/importar";
import { codigoDeSalida, formatearReporte } from "../src/plan/importar/reporte";

const MAX_BYTES_FICHA = 256 * 1024;
const USO = "Uso: npx tsx scripts/importar-plan.ts --ficha <ruta.md> --email <correo-del-dueño> [--aplicar]";

function salir(mensaje: string, codigo: number): never {
  console.error(mensaje);
  process.exit(codigo);
}

/** `existsSync` sigue el enlace: uno roto daría «no existe»; `lstatSync` mira el enlace mismo. */
function isEnlace(ruta: string): boolean {
  try {
    return lstatSync(ruta).isSymbolicLink();
  } catch {
    return false;
  }
}

function urlDeLaBase(): string {
  if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env"); // no pisa lo que ya está en el entorno
  const url = process.env.DATABASE_URL;
  if (!url) salir("❌ Falta DATABASE_URL: no se sabe en qué base trabajar.", 2);
  return url;
}

/** Solo el nombre de la base (sin usuario, clave ni servidor), para saber dónde se va a escribir. */
function nombreDeLaBase(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, "")) || "(sin nombre)";
  } catch {
    return "(URL inválida)";
  }
}

async function main(): Promise<void> {
  const args = leerArgumentos(process.argv.slice(2));
  if (!args.ok) salir(USO, 2);
  const info = existsSync(args.ficha) || isEnlace(args.ficha) ? lstatSync(args.ficha) : null;
  if (info?.isSymbolicLink()) salir("❌ La ficha es un enlace simbólico: no se sigue. Pase la ruta del archivo.", 2);
  if (!info?.isFile()) salir("❌ La ficha no existe o no es un archivo.", 2);
  if (info.size > MAX_BYTES_FICHA) salir("❌ La ficha pasa de 256 KB: no se importa.", 2);
  const url = urlDeLaBase();
  const db = new PrismaClient({ datasourceUrl: url });
  try {
    console.log(`Base: ${nombreDeLaBase(url)}`);
    const r = await importarFicha(db, { contenido: readFileSync(args.ficha, "utf8"), email: args.email, aplicar: args.aplicar }, { url });
    for (const linea of formatearReporte(r, basename(args.ficha))) console.log(linea);
    process.exitCode = codigoDeSalida(r);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e: unknown) => {
  // Solo la clase y el código: el mensaje de un error de PostgreSQL puede traer valores de la fila.
  // Si el error sube hasta aquí, esta corrida no escribió nada (lo escrito a mitad vuelve como FALLO_PARCIAL).
  const codigo = e instanceof Error && "codigo" in e ? ` (${String((e as { codigo: unknown }).codigo)})` : "";
  console.error(`❌ La importación falló: ${e instanceof Error ? e.name : "error"}${codigo}. No se escribió nada.`);
  process.exit(1);
});
