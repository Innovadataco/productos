/**
 * SPEC-708 (#665) — realineación quirúrgica de la BD de test COMPARTIDA.
 *
 * POR QUÉ EXISTE
 * La rama de SPEC-708 re-dató/renombró su migración: una iteración vieja
 * (`20260918000000_spec708_direccion_enlace`, commit ab9e8a11e, force-pusheada
 * fuera del árbol) alcanzó a aplicarse a la BD de test compartida y agregó DOS
 * columnas a "PerfilProfesional": `direccionAtencion` y `enlaceVideollamada`.
 * El repo AHORA declara SOLO `20260925000000_spec708_direccion_atencion` (una
 * sola columna). Resultado: la fila 0918 quedó HUÉRFANA en `_prisma_migrations`
 * (nombre sin carpeta) y `migrate deploy` ve drift; además `enlaceVideollamada`
 * sobra. Este script deja la BD lista para RE-APLICAR limpio la migración nueva.
 *
 * QUÉ HACE (idempotente, transaccional, dry-run por defecto):
 *   1) DROP COLUMN IF EXISTS de las dos columnas de la era enlace.
 *   2) DELETE de la fila huérfana de `_prisma_migrations` por nombre EXACTO.
 * Después, el `prisma migrate deploy` normal aplica `..._direccion_atencion` y
 * re-agrega SOLO `direccionAtencion`. Idempotente no es no-destructivo: si apunta
 * mal, borra bien — por eso los guardas de abajo.
 *
 * SEGURIDAD (fallar CERRADO — nunca contra la BD viva):
 *   - Reusa `validarBdDeTest` (SPEC-352, fuente única del guard de `resetDatabase`):
 *     ABORTA en voz alta salvo que el NOMBRE de la base contenga "test". Bloquea
 *     dev, producción y URL vacía.
 *   - Cruce EN VIVO: tras conectar, vuelve a validar con `current_database()` — el
 *     nombre REAL de la conexión, no solo el string del env (pooling/proxy podrían
 *     desviar). Si la base viva no es de test → aborta antes de tocar una fila.
 *   - Rechaza `NODE_ENV=production`.
 *   - Destructivo SOLO con `--confirm`; sin él es dry-run (inspecciona y sale).
 *   - `parseArgs` aborta ante cualquier flag no reconocido (un flag tragado en
 *     silencio en un script destructivo es una trampa).
 *
 * USO
 *   Dry-run (default, no toca nada):
 *     node --env-file=.env.test --import tsx scripts/limpieza/reset-bd-test-spec708.ts \
 *       --motivo="realinear BD test compartida SPEC-708 ventana <fecha>"
 *   Aplicar (ventana abierta, DATABASE_URL apuntando a la BD de test compartida):
 *     ... reset-bd-test-spec708.ts --motivo="..." --confirm
 *   Backup opcional recomendado antes de --confirm:
 *     pg_dump "$DATABASE_URL" > /tmp/backup-bdtest-spec708.sql
 */
import { prisma } from "../../src/lib/prisma";
import { validarBdDeTest } from "../../src/lib/test-utils";
import { parseArgs, requerirMotivo, log } from "./_common";

const TABLA = "PerfilProfesional";
/** Las dos columnas que agregó la migración vieja de la era enlace (ab9e8a11e). */
const COLUMNAS_ERA_ENLACE = ["enlaceVideollamada", "direccionAtencion"] as const;
/** La fila que quedó huérfana en `_prisma_migrations` (nombre sin carpeta en el repo). */
const MIGRACION_HUERFANA = "20260918000000_spec708_direccion_enlace";

const PREFIJO = "reset-bd-test-spec708";

async function contarFilaHuerfana(): Promise<number> {
    const rows = await prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM "_prisma_migrations"
         WHERE migration_name = ${MIGRACION_HUERFANA}
    `;
    return rows[0]?.n ?? 0;
}

async function contarFilasSpec708(): Promise<number> {
    const rows = await prisma.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM "_prisma_migrations"
         WHERE migration_name LIKE '%spec708%'
    `;
    return rows[0]?.n ?? 0;
}

async function contarColumnasEraEnlace(): Promise<number> {
    // TABLA y COLUMNAS_ERA_ENLACE son constantes del script (no entrada de usuario):
    // inlinearlas como literales SQL es seguro y evita la ambigüedad de bindear un
    // array de JS a `ANY(...)` en $queryRaw.
    const inList = COLUMNAS_ERA_ENLACE.map((c) => `'${c}'`).join(", ");
    const rows = await prisma.$queryRawUnsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = '${TABLA}'
            AND column_name IN (${inList})`,
    );
    return rows[0]?.n ?? 0;
}

/**
 * Cruce EN VIVO del guard: valida el nombre REAL de la base conectada, no solo el
 * string del env. Reusa la MISMA lógica de `validarBdDeTest` (fuente única) pasándole
 * el nombre desnudo — su split("/")/split("?") lo deja intacto y decide por "test".
 */
async function afirmarBaseVivaEsDeTest(): Promise<string> {
    const rows = await prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    const db = rows[0]?.db ?? "";
    validarBdDeTest(db); // lanza BLOQUEADO si la base viva no es de test
    return db;
}

async function main(): Promise<void> {
    // 1) Args estrictos. --confirm aplica; sin él, dry-run.
    const args = parseArgs(process.argv, ["confirm", "motivo"]);
    const motivo = requerirMotivo(typeof args.motivo === "string" ? args.motivo : undefined);
    const aplicar = args.confirm === true;

    // 2) Guardas fail-closed ANTES de tocar nada.
    if (process.env.NODE_ENV === "production") {
        throw new Error(`[${PREFIJO}] BLOQUEADO: NODE_ENV=production. Este script jamás corre contra prod.`);
    }
    validarBdDeTest(process.env.DATABASE_URL); // por el string del env (SPEC-352)
    const dbViva = await afirmarBaseVivaEsDeTest(); // por current_database() (cruce en vivo)
    log(PREFIJO, `Base destino verificada como de test: "${dbViva}". Motivo: ${motivo}`);

    // 3) Estado ANTES (siempre, dry-run incluido).
    const filaAntes = await contarFilaHuerfana();
    const colsAntes = await contarColumnasEraEnlace();
    log(PREFIJO, `ANTES · fila huérfana "${MIGRACION_HUERFANA}" = ${filaAntes} (esperado 1 la 1ra vez; 0 si ya corrió)`);
    log(PREFIJO, `ANTES · columnas era-enlace presentes en "${TABLA}" = ${colsAntes} de ${COLUMNAS_ERA_ENLACE.length} (${COLUMNAS_ERA_ENLACE.join(", ")})`);

    if (!aplicar) {
        log(PREFIJO, "DRY-RUN: nada se ejecutó. Re-corré con --confirm para aplicar (idempotente).");
        return;
    }

    // 4) Quirúrgico, atómico. DDL transaccional en Postgres.
    await prisma.$transaction(async (tx) => {
        for (const col of COLUMNAS_ERA_ENLACE) {
            await tx.$executeRawUnsafe(`ALTER TABLE "${TABLA}" DROP COLUMN IF EXISTS "${col}"`);
        }
        await tx.$executeRawUnsafe(
            `DELETE FROM "_prisma_migrations" WHERE migration_name = '${MIGRACION_HUERFANA}'`,
        );
    });

    // 5) Verificación POST-commit: ambos deben quedar en 0. Si no, exit≠0.
    const filaDespues = await contarFilasSpec708();
    const colsDespues = await contarColumnasEraEnlace();
    log(PREFIJO, `DESPUÉS · filas spec708 en _prisma_migrations = ${filaDespues} (esperado 0)`);
    log(PREFIJO, `DESPUÉS · columnas era-enlace en "${TABLA}" = ${colsDespues} (esperado 0; migrate deploy re-agrega direccionAtencion)`);
    if (filaDespues !== 0 || colsDespues !== 0) {
        throw new Error(
            `[${PREFIJO}] La realineación NO dejó el estado esperado (filas=${filaDespues}, columnas=${colsDespues}). ` +
                "Revisá la BD antes de correr `prisma migrate deploy`.",
        );
    }
    log(PREFIJO, "REALIZADO. Ahora corré `prisma migrate deploy` para aplicar 20260925000000_spec708_direccion_atencion.");
}

if (process.argv[1]?.endsWith("reset-bd-test-spec708.ts")) {
    main()
        .catch((err: unknown) => {
            console.error(`[${PREFIJO}] Error:`, err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
