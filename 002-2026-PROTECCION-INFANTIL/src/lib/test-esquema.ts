/**
 * SPEC-817 · pieza 2 · Verificación de ESQUEMA al arrancar integración.
 *
 * El defecto: 15 archivos de test referencian entidades de migraciones recién aplicadas y 0 verifican que el
 * esquema esté al día antes de correr. Un fallo por columna faltante es INDISTINGUIBLE de un defecto —fue lo
 * que le ocultó un candado real a Dev 1 una madrugada—. Esta pieza hace que el arranque VERIFIQUE y falle con
 * un mensaje que DICE «esquema desactualizado», en vez de dejar que el test caiga como si fuera un defecto.
 *
 * Parte pura y testeable: comparar las migraciones de la carpeta contra las aplicadas en la base. La lectura
 * real (`_prisma_migrations`, filesystem) vive en el globalSetup; acá va la lógica que el candado ejercita.
 */
import fs from "node:fs";
import path from "node:path";

/** Nombres de migración en `prisma/migrations/` (cada subcarpeta es una migración; se ignora el lock). */
export function migracionesEnCarpeta(dirMigraciones: string): string[] {
    if (!fs.existsSync(dirMigraciones)) return [];
    return fs
        .readdirSync(dirMigraciones, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();
}

/**
 * Migraciones que la CARPETA tiene y la BASE no aplicó aún. Pura: recibe las dos listas. Si está vacío, el
 * esquema está al día (la base puede tener MÁS —ramas viejas—, eso no bloquea leer; lo que rompe es que al
 * test le FALTE una columna que su migración traía).
 */
export function migracionesFaltantes(aplicadas: readonly string[], enCarpeta: readonly string[]): string[] {
    const set = new Set(aplicadas);
    return enCarpeta.filter((m) => !set.has(m));
}

/** Mensaje que DICE que el problema es el esquema, con la salida accionable (no un fallo de test ambiguo). */
export function mensajeEsquemaDesactualizado(faltantes: readonly string[], base: string): string {
    const lista = faltantes.slice(0, 5).join(", ") + (faltantes.length > 5 ? `, …(+${faltantes.length - 5})` : "");
    return (
        `[SPEC-817] ESQUEMA DESACTUALIZADO en la base «${base}»: faltan ${faltantes.length} migración(es) por aplicar ` +
        `(${lista}). Esto NO es un defecto del test — la base está atrás del repo. Corré «npx prisma migrate deploy» ` +
        "contra esa base y volvé a correr. (El arnés deriva la base por worktree: SPEC-817.)"
    );
}

/** Ruta estándar de las migraciones de este producto, relativa a la raíz del paquete. */
export function dirMigracionesPorDefecto(raizPaquete: string): string {
    return path.join(raizPaquete, "prisma", "migrations");
}
