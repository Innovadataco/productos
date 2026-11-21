/**
 * Cifrado de lo existente (#11): fila_fuente.crudo y certificacion_fondo.encargo.
 *   npx tsx scripts/cifrar-existentes.ts                               ensayo: solo conteos, no escribe
 *   npx tsx scripts/cifrar-existentes.ts --aplicar --base <nombre>     cifra lo que está en claro
 *   npx tsx scripts/cifrar-existentes.ts --re-cifrar --base <nombre>   pasa a la versión activa los sobres de otra
 * Usa DATABASE_URL y las claves CIFRADO_CLAVE_ACTIVA / CIFRADO_CLAVE_V<n> (del entorno o de la .env).
 * Imprime solo el nombre de la base y conteos: nunca valores. Idempotente: se puede repetir.
 * Antes de --aplicar en la base de trabajo: respaldo de las claves (gestor de contraseñas) y pg_dump cifrado.
 * Se corre con los importadores detenidos y DOS veces: la segunda debe dar 0 cambios. Al final se
 * recomienda VACUUM (ANALYZE) de las dos tablas. Salida: 0 sin alertas · 1 con alertas o error · 2 uso.
 */
import { PrismaClient } from "@prisma/client"; // al importarse carga la .env: va antes de leer las claves
import { ErrorArgumentos, leerArgumentos, USO, type Argumentos } from "../src/cifrado/argumentos";
import { cifrarExistentes, codigoDeSalida, type ConteoTabla } from "../src/cifrado/migracion";

function linea(tabla: string, c: ConteoTabla): string {
  const versiones = Object.entries(c.porVersion).sort(([a], [b]) => a.localeCompare(b)).map(([v, k]) => `${v}: ${k}`).join(", ") || "ninguno";
  return (
    `${tabla}: ${c.total} filas · en claro ${c.enClaro} · sobres por versión (${versiones}) · sin su clave ${c.sinClave}` +
    ` · no abren con su clave ${c.noAbren} · cambiadas por otro (no se pisaron) ${c.concurrentes}` +
    ` · anómalas ${c.anomalas} · cifradas ahora ${c.cifradasAhora} · re-cifradas ahora ${c.reCifradasAhora}`
  );
}

function modo(a: Argumentos): string {
  if (!a.aplicar && !a.reCifrar) return "ENSAYO (no escribe)";
  return [a.aplicar ? "APLICAR (cifra lo que está en claro)" : "", a.reCifrar ? "RE-CIFRAR (a la versión activa)" : ""].filter(Boolean).join(" + ");
}

async function main(): Promise<number> {
  let argumentos: Argumentos;
  try {
    argumentos = leerArgumentos(process.argv.slice(2));
  } catch (e) {
    if (!(e instanceof ErrorArgumentos)) throw e;
    console.error(`❌ ${e.message}\n${USO}`);
    return codigoDeSalida(e);
  }
  const db = new PrismaClient();
  try {
    const r = await cifrarExistentes(db, argumentos);
    console.log(`Base: ${r.base} · versión activa: ${r.activa} · modo: ${modo(argumentos)} · lote: ${argumentos.lote}`);
    console.log(linea("fila_fuente", r.filaFuente));
    console.log(linea("certificacion_fondo", r.certificacionFondo));
    const escritas = [r.filaFuente, r.certificacionFondo].reduce((suma, c) => suma + c.cifradasAhora + c.reCifradasAhora, 0);
    if (escritas > 0) {
      console.log("Siguiente: corra el mismo comando otra vez (debe dar 0 cambios) y después VACUUM (ANALYZE) fila_fuente; VACUUM (ANALYZE) certificacion_fondo;");
    }
    const codigo = codigoDeSalida(r);
    if (codigo !== 0) {
      console.error("⚠️  Hay valores anómalos, sin su clave, que no abren con su clave o cambiados por otro durante la corrida: no se tocaron. Revíselos y vuelva a correr.");
    }
    return codigo;
  } finally {
    await db.$disconnect();
  }
}

main()
  .then((codigo) => process.exit(codigo))
  .catch((e: unknown) => {
    // Solo errores propios llevan mensaje (son fijos y sin valores); de los demás, solo el nombre.
    const propio = e instanceof Error && (e.name === "ErrorCifrado" || e.name === "ErrorMigracion");
    const codigo = e instanceof Error && "codigo" in e ? ` (${String((e as { codigo: unknown }).codigo)})` : "";
    console.error(`❌ La migración falló: ${e instanceof Error ? e.name : "error"}${codigo}${propio ? `: ${(e as Error).message}` : ""}`);
    process.exit(1);
  });
