/**
 * SPEC-767 · Guardián de HISTORIAL ≠ ESQUEMA — DURO (gate tras #766).
 *
 * ¿El HISTORIAL de migraciones CONSTRUYE el esquema declarado? Corre migrate diff contra un shadow
 * LIMPIO (replaya las migraciones ahí) y clasifica con la FUENTE ÚNICA de Datos
 * (drift-clasificador.ts, SPEC-760) — cero copia del criterio. Si queda `drift` real (columna/
 * constraint que las migraciones no construyen o construyen de más, como el Plan.creadoEn huérfano
 * de SPEC-766) → exit 1.
 *
 * DISTINTO de los otros dos (ninguno ve lo del otro — por eso el drift de Plan vivió invisible):
 *  · SPEC-760: esquema vs BD VIVA de prod (drift de DATO), BLANDO.
 *  · I-420 (no-drift-destructivo-migracion): scan ESTÁTICO de archivos de migración.
 *  · 767 (este): migraciones vs esquema DECLARADO (drift de HISTORIAL), DURO.
 *
 * DIRECCIÓN (verificada): --from-schema-datamodel --to-migrations (migraciones = target) para que
 * el punto ciego de Prisma salga como SET DATA TYPE TIMESTAMPTZ y CREATE de índice crudo — que el
 * clasificador SÍ matchea. La inversa emite SET TIMESTAMP(3)/DROP INDEX, que NO matchearía.
 *
 * Uso (CI): SHADOW_DATABASE_URL=… node --import tsx scripts/verify-historial-esquema.ts [--json]
 * Exit: 0 = el historial construye el esquema · 1 = drift de historial · 2 = infra.
 */
import { execFileSync } from "node:child_process";
import { clasificarDrift, partirStatements } from "../src/lib/monitoreo/drift-clasificador";

// Re-export para que el candado importe la MISMA fuente por el mismo camino que el sibling #760.
export { clasificarDrift, partirStatements } from "../src/lib/monitoreo/drift-clasificador";

/**
 * Baseline DOCUMENTADO de los 8 renombres de índice (SPEC-767, T4). El clasificador ya los pasa
 * como benignos por su categoría genérica `rename-indice`; NO se «arreglan» (un guardián que grita
 * cosméticos se apaga). Se dejan acá EN RECORD con su razón para que consten. Razón única: skew de
 * nombre Prisma↔migración sobre LAS MISMAS columnas (Prisma emite `<tabla>_<cols>_idx`, la migración
 * cruda los nombró `idx_<tabla>_<cols>`); el 8º es un renombre `_idx`→`_desc_idx` sobre las mismas
 * columnas. Ninguno cambia columnas ni unicidad. Puramente informativo (no lo consume la lógica).
 */
export const RENOMBRES_INDICE_BASELINE: readonly string[] = [
    "notificaciones_estado_enviarEn_idx → idx_notificaciones_estado_enviarEn",
    "notificaciones_destinatarioUsuarioId_createdAt_idx → idx_notificaciones_destinatarioUsuarioId_createdAt",
    "notificaciones_evento_createdAt_idx → idx_notificaciones_evento_createdAt",
    "notificaciones_proveedorId_idx → idx_notificaciones_proveedorId",
    "notificacion_reglas_evento_activa_idx → idx_notificacion_reglas_evento_activa",
    "notificacion_preferencias_usuarioId_idx → idx_notificacion_preferencias_usuarioId",
    "notificacion_contactos_bloqueados_email_idx → idx_notificacion_contactos_bloqueados_email",
    "AnalisisExpediente_expedienteId_versionSecuencial_idx → AnalisisExpediente_expedienteId_versionSecuencial_desc_idx",
];

export function obtenerScriptDeDrift(
    schemaPath = "prisma/schema.prisma",
    migrationsPath = "prisma/migrations",
    shadowUrl = process.env.SHADOW_DATABASE_URL,
): string {
    if (!shadowUrl) {
        throw new Error("[historial] SHADOW_DATABASE_URL no definido — se necesita un shadow LIMPIO para replayar las migraciones.");
    }
    return execFileSync(
        "npx",
        ["prisma", "migrate", "diff", "--from-schema-datamodel", schemaPath, "--to-migrations", migrationsPath, "--shadow-database-url", shadowUrl, "--script"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
}

const esEntryPoint =
    process.argv[1] !== undefined &&
    (process.argv[1].endsWith("verify-historial-esquema.ts") || process.argv[1].endsWith("verify-historial-esquema.js"));

if (esEntryPoint) {
    const jsonMode = process.argv.includes("--json");
    const watchdog = setTimeout(() => {
        console.error("[historial] TIMEOUT: migrate diff tardó más de 30s — revisar el shadow");
        process.exit(2);
    }, 30000);
    watchdog.unref();
    try {
        const { benignas, drift } = clasificarDrift(partirStatements(obtenerScriptDeDrift()));
        clearTimeout(watchdog);
        const porCat = benignas.reduce<Record<string, number>>((a, b) => ((a[b.categoria] = (a[b.categoria] ?? 0) + 1), a), {});
        console.log(`[historial] baseline benigno: ${benignas.length} (${Object.entries(porCat).map(([k, v]) => `${k}=${v}`).join(", ") || "ninguna"})`);
        if (jsonMode) console.log(JSON.stringify({ ok: drift.length === 0, driftHistorial: drift.length, drift }));
        if (drift.length === 0) {
            console.log("[historial] VERDE: las migraciones construyen el esquema declarado (salvo el punto ciego de Prisma, baselineado con razón por Datos).");
        } else {
            console.error(`[historial] ROJO: ${drift.length} sentencia(s) de DRIFT DE HISTORIAL — las migraciones NO construyen el esquema:`);
            for (const d of drift) console.error(`  · ${d}`);
            console.error("[historial] Reparar con migración aditiva que reconcilie historial↔esquema. NO se aplica esquema a prod fuera de migraciones.");
            process.exit(1);
        }
    } catch (error) {
        clearTimeout(watchdog);
        const msg = error instanceof Error ? error.message : String(error);
        if (jsonMode) console.log(JSON.stringify({ ok: false, error: msg }));
        else console.error("[historial] Error de infra (¿shadow inalcanzable? ¿migrate diff falló?):", msg);
        process.exit(2);
    }
}
