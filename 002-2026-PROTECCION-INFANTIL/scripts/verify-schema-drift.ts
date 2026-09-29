/**
 * SPEC-760 (D-121) · Guardián de DRIFT de esquema — CLI (born-green / corrida manual).
 * BLANDO, solo-lectura, contra la BD VIVA.
 *
 * El CRITERIO (qué es benigno vs drift) vive en `src/lib/monitoreo/drift-clasificador.ts`,
 * FUENTE ÚNICA que este CLI comparte con el probe de pi-monitor (`probeDriftEsquema`). Acá
 * solo está el motor de obtención (shell a `prisma migrate diff`) y la salida CLI.
 *
 * Nace del hallazgo de SPEC-759: FK que el esquema declara y ninguna migración creó faltaban
 * en prod, test compartida Y en CI fresco — porque CI arma desde las migraciones. Un guardián
 * sobre base FRESCA nunca lo vería; por eso corre CONTRA LA BASE VIVA con rol de SOLO LECTURA.
 *
 * BLANDO: exit 0 SIEMPRE aunque haya drift (WARN), porque el set es abierto y puede empezar
 * rojo — nunca gate duro de deploy. exit 2 solo para infra, con watchdog. Correr con el esquema
 * DESPLEGADO contra la base de esa MISMA versión (un esquema de rama reporta skew de versión).
 *
 * Uso:  node --env-file=.env.production --import tsx scripts/verify-schema-drift.ts [--json]
 * Exit: 0 = sin drift real (o drift reportado, BLANDO) · 2 = error de infra.
 */
import { execFileSync } from "node:child_process";
import { clasificarDrift, partirStatements } from "../src/lib/monitoreo/drift-clasificador";

// Re-export para consumidores del CLI (p.ej. el candado co-locado).
export { clasificarDrift, partirStatements } from "../src/lib/monitoreo/drift-clasificador";

/** Motor sincrónico del CLI: obtiene el `--script` de migrate diff (read-only). El probe usa
 *  su propia variante ASÍNCRONA con timeout duro (no bloquea el loop del monitor). */
export function obtenerScriptDeDrift(schemaPath = "prisma/schema.prisma", dbUrl = process.env.DATABASE_URL): string {
    if (!dbUrl) throw new Error("[drift] DATABASE_URL no definido — apuntá a la BD VIVA con un rol de SOLO LECTURA.");
    return execFileSync(
        "npx",
        ["prisma", "migrate", "diff", "--from-schema-datamodel", schemaPath, "--to-url", dbUrl, "--script"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
}

const esEntryPoint =
    process.argv[1] !== undefined &&
    (process.argv[1].endsWith("verify-schema-drift.ts") || process.argv[1].endsWith("verify-schema-drift.js"));

if (esEntryPoint) {
    const jsonMode = process.argv.includes("--json");
    const watchdog = setTimeout(() => {
        console.error("[drift] TIMEOUT: migrate diff tardó más de 20s — revisar conectividad a la BD viva");
        process.exit(2);
    }, 20000);
    watchdog.unref();

    try {
        const script = obtenerScriptDeDrift();
        const { benignas, drift } = clasificarDrift(partirStatements(script));
        clearTimeout(watchdog);

        if (jsonMode) {
            console.log(JSON.stringify({ ok: drift.length === 0, driftReal: drift.length, benignas: benignas.length, drift }));
        } else {
            const porCategoria = benignas.reduce<Record<string, number>>((acc, b) => {
                acc[b.categoria] = (acc[b.categoria] ?? 0) + 1;
                return acc;
            }, {});
            console.log(`[drift] baseline benigno: ${benignas.length} sentencias (${Object.entries(porCategoria).map(([k, v]) => `${k}=${v}`).join(", ") || "ninguna"})`);
            if (drift.length === 0) {
                console.log("[drift] VERDE: cero drift real — el esquema vivo coincide con lo declarado (salvo el punto ciego de Prisma, baselineado con razón).");
            } else {
                console.warn(`[drift] ⚠️ ${drift.length} DRIFT REAL (guardián BLANDO — no bloquea, pero triar YA):`);
                for (const d of drift) console.warn(`  · ${d}`);
                console.warn("[drift] Triar: reparar (migración aditiva) o, si es un objeto crudo legítimo nuevo, agregarlo al baseline CON RAZÓN.");
            }
        }
        // BLANDO: nunca exit≠0 por drift. Solo infra (abajo) sube 2.
    } catch (error) {
        clearTimeout(watchdog);
        const msg = error instanceof Error ? error.message : String(error);
        if (jsonMode) console.log(JSON.stringify({ ok: false, error: msg }));
        else console.error("[drift] Error de infra (¿BD viva inalcanzable? ¿migrate diff falló?):", msg);
        process.exitCode = 2;
    }
}
