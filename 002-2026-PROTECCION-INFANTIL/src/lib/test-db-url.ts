/**
 * SPEC-817 · Resolución de `DATABASE_URL` para el arnés de pruebas: UNA BASE POR WORKTREE.
 *
 * El defecto (I-439): `.env.test` fijaba UNA base compartida (`…/proteccion_infantil_test`) para los siete
 * worktrees en paralelo. Cada suite de integración TRUNCA esa base como reset normal (515 archivos); el
 * `TRUNCATE` rutinario de un worktree cae ENTRE el seed y la aserción de otro → falso rojo / falso verde. La
 * limpieza correcta de uno destruye el estado correcto de otro. Solo base-por-worktree lo cierra.
 *
 * El mecanismo, y es EXPLÍCITO (veredicto CEO · opción A): **respeto · derivo · exploto.**
 *   - Si el ENTORNO ya provee `DATABASE_URL` —el caso de CI, que lo escribe en su `.env.test`— se RESPETA
 *     TAL CUAL. La derivación NO se dispara ahí: por eso CI no cambia.
 *   - Si NO hay `DATABASE_URL` —el caso local, porque `.env.test` dejó de fijarlo— se DERIVA del worktree.
 *   - Si no se puede derivar → THROW. **Nunca** se cae al compartido `proteccion_infantil_test`: un fallback
 *     reconectaría a todos al bug que esta spec existe para cerrar, y en silencio.
 *
 * El discriminador sale de la UBICACIÓN DE ESTE MÓDULO (no de `cwd`), así es robusto sin importar desde dónde
 * se corra: la carpeta que contiene a `002-2026-PROTECCION-INFANTIL` es el worktree (`…/.worktrees/pi-825`,
 * `…/productos`). Nombre resultante: `proteccion_infantil_<disc>_test` — termina en `_test` para pasar la
 * guardia de SPEC-770 (que mira el SUFIJO, no el nombre exacto).
 *
 * Importado como PRIMER efecto de los setups de test (antes de `./prisma`, que lee `DATABASE_URL` al
 * construirse) y del `playwright.config`.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";

const DIR_PRODUCTO = "002-2026-PROTECCION-INFANTIL";
/** La base COMPARTIDA vieja (I-439). La derivación nunca la produce ni cae a ella. */
export const BASE_COMPARTIDA_LEGADO = "proteccion_infantil_test";
/** Credenciales/host del Postgres de pruebas local (dummy, mismas que el `.env.test` histórico). */
const DSN_LOCAL = "postgresql://proteccion:proteccion_dev@localhost:5433";

/**
 * Discriminador por worktree: basename —saneado a nombre de base válido— de la carpeta que CONTIENE a
 * `002-2026-PROTECCION-INFANTIL`. Deriva de `desde` (por defecto, la ruta de este módulo). THROW si no puede:
 * un discriminador vacío o una ruta sin el producto es «no puedo derivar», y eso explota, no cae al compartido.
 */
export function discriminadorWorktree(desde: string = fileURLToPath(import.meta.url)): string {
    const marca = `${path.sep}${DIR_PRODUCTO}${path.sep}`;
    const i = desde.indexOf(marca);
    if (i < 0) {
        throw new Error(
            `[SPEC-817] No puedo derivar la base por worktree: la ruta «${desde}» no contiene «${DIR_PRODUCTO}». ` +
                "El arnés NO cae a la base compartida; corregí la ubicación o provisioná DATABASE_URL.",
        );
    }
    const raizWorktree = desde.slice(0, i); // …/.worktrees/pi-825  ó  …/productos
    const disc = path
        .basename(raizWorktree)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
    if (!disc) {
        throw new Error(`[SPEC-817] Discriminador de worktree vacío para «${raizWorktree}». El arnés no cae al compartido.`);
    }
    return disc;
}

/** Nombre de base por worktree. Termina en `_test` (guardia SPEC-770) y NUNCA es el compartido pelado. */
export function nombreBasePorWorktree(disc: string = discriminadorWorktree()): string {
    const nombre = `proteccion_infantil_${disc}_test`;
    if (nombre === BASE_COMPARTIDA_LEGADO) {
        // Inalcanzable con `disc` no vacío, pero afirmado: jamás devolver la base del defecto.
        throw new Error(`[SPEC-817] La base derivada coincide con la compartida «${BASE_COMPARTIDA_LEGADO}»; reintroduciría I-439.`);
    }
    return nombre;
}

/**
 * Resuelve el destino de `DATABASE_URL` para pruebas. NO muta el entorno (eso lo hace el efecto de abajo).
 * `origen` es el contrato que afirma el candado de CI-safety:
 *   - `"entorno"`  → había un `DATABASE_URL`; se devuelve TAL CUAL (CI). La derivación no se disparó.
 *   - `"derivada"` → no había; se derivó por worktree.
 */
export function resolverDatabaseUrl(
    env: Record<string, string | undefined> = process.env,
): { url: string; origen: "entorno" | "derivada" } {
    const provisto = env.DATABASE_URL?.trim();
    if (provisto) return { url: provisto, origen: "entorno" };
    return { url: `${DSN_LOCAL}/${nombreBasePorWorktree()}`, origen: "derivada" };
}

/**
 * Resolución CONGELADA al cargar el módulo (primer import), ANTES de mutar `process.env`. `origen` refleja si
 * el ENTORNO traía DATABASE_URL (CI) o no (local) — un `resolverDatabaseUrl()` llamado DESPUÉS vería el valor
 * que el efecto de abajo instaló y creería que siempre es "entorno" (saltándose la provisión por worktree).
 * El globalSetup lee ESTO para conocer el régimen real.
 */
export const RESOLUCION_DATABASE_URL = resolverDatabaseUrl();

// Efecto al importar: fija `process.env.DATABASE_URL` ANTES de que `./prisma` construya el cliente.
// En el caso "entorno" es el mismo valor (no pisa nada); en "derivada" instala la base del worktree.
process.env.DATABASE_URL = RESOLUCION_DATABASE_URL.url;
