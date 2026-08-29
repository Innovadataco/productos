/**
 * SPEC-223 (002-PI-124): registro del schedule del digest semanal al CEO.
 * Extraído de worker-reportes.mjs (regla max-lines 500). El cron se deriva de
 * analisis.digest.hora_bogota / analisis.digest.dia_semana al arranque (molde
 * worker-tasas.mjs); un restart aplica cambios de parámetro. La lógica vive en
 * src/lib/analisis/digest-semanal.ts (script delgado, handler importable).
 */
import { getParametroSistemaValor } from "../src/lib/parametros.ts";

export async function registrarScheduleDigestSemanal(boss, logger, ensureQueue) {
    const digestDia = Number.parseInt(
        (await getParametroSistemaValor("analisis.digest.dia_semana")) ?? "1",
        10
    );
    const digestHora = Number.parseInt(
        (await getParametroSistemaValor("analisis.digest.hora_bogota")) ?? "8",
        10
    );
    const digestDiaValido = Number.isInteger(digestDia) && digestDia >= 0 && digestDia <= 6 ? digestDia : 1;
    const digestHoraValida = Number.isInteger(digestHora) && digestHora >= 0 && digestHora <= 23 ? digestHora : 8;
    const cronDigest = `0 ${digestHoraValida} * * ${digestDiaValido}`;
    await ensureQueue("analisis-digest-semanal");
    await boss.schedule("analisis-digest-semanal", cronDigest, {}, { tz: "America/Bogota" });
    console.log(`[WORKER] schedule analisis-digest-semanal registrado: cron "${cronDigest}" tz America/Bogota`);
    await boss.work("analisis-digest-semanal", async (jobs) => {
        const job = Array.isArray(jobs) ? jobs[0] : jobs;
        const jobId = job?.id;
        await logger.info("Procesando job", { cola: "analisis-digest-semanal", jobId });
        try {
            const { ejecutarDigestSemanal } = await import("../src/lib/analisis/digest-semanal.ts");
            const resultado = await ejecutarDigestSemanal();
            await logger.info("Job completado", { cola: "analisis-digest-semanal", jobId, ...resultado });
            return { success: true, ...resultado };
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error desconocido";
            console.error(`[WORKER] ERROR digest semanal: ${msg}`);
            await logger.error("Job falló", { cola: "analisis-digest-semanal", jobId, error: msg });
            throw err;
        }
    });
}
