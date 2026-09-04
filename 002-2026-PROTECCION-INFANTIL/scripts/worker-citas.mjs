#!/usr/bin/env node
/**
 * Worker pg-boss de la cita profesional (SPEC-427 · I-301).
 *
 * ## Por qué existe
 * SPEC-395 dejó dos barredores escritos y probados —`barrerAvisoVencimiento48h`
 * y `barrerPlazoPagoDelPadre`— **que no llamaba nadie**. Ni un `boss.schedule`,
 * ni un servicio en el compose: el reloj de 48 h del brief §3 nunca corrió en
 * producción, la franja de una solicitud sin responder no se liberaba, y el
 * padre no recibía el aviso. Pasaban los tests y no hacían nada.
 *
 * Este worker es la casa de los CUATRO barredores de la cita. Si mañana alguien
 * agrega un quinto y no lo llama desde acá, el candado
 * `src/lib/profesional/cita/worker.candado.test.ts` rompe el build: el arreglo
 * tiene que avisar la próxima vez, no confiar en que alguien se acuerde.
 *
 * ## Arranque liviano
 * Depende solo de Postgres. No toca Ollama ni el motor de IA: si el modelo está
 * caído, las citas se siguen cerrando.
 */

import {
    barrerAvisoVencimiento48h,
    barrerPlazoPagoDelPadre,
} from "../src/lib/profesional/cita/worker.ts";
import {
    barrerRecordatoriosDeCita,
    barrerAutocierre,
} from "../src/lib/profesional/cita/cierre.service.ts";
import { barrerRecordatoriosDeExpediente } from "../src/lib/profesional/cita/expediente.service.ts";
import { boss, ensureStarted, ensureQueue } from "../src/lib/queue.ts";
import { iniciarTickVida } from "../src/lib/monitoreo/tick-vida.ts";
import pg from "pg";

iniciarTickVida("pi-citas"); // SPEC-291: healthcheck externo + monitor

const { Client } = pg;
// ID propio, tomado de scripts/ADVISORY-LOCKS.md (era el siguiente libre).
// Sin separadores `_` a propósito: un `_` escondió la colisión de I-130 durante
// tres semanas porque el grep no la encontraba. No lo "corrijas".
const ADVISORY_LOCK_ID = 123456800;

/**
 * Cada 5 minutos. El recordatorio sale 10 minutos antes de la cita, así que la
 * ventana de barrido tiene que ser holgadamente menor que esos 10 minutos —
 * si no, una cita podría empezar sin que su código se haya emitido.
 */
const CRON_CADA_5_MIN = "*/5 * * * *";
/** El autocierre mira días: una vez al día, de madrugada, alcanza y sobra. */
const CRON_DIARIO = "20 3 * * *";

const COLA_MINUTO = "citas-barrido-minuto";
const COLA_DIARIO = "citas-barrido-diario";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("[WORKER-CITAS] ERROR: DATABASE_URL no configurada");
    process.exit(1);
}

let lockClient = null;

async function acquireAdvisoryLock() {
    lockClient = new Client({ connectionString: DATABASE_URL });
    await lockClient.connect();
    const result = await lockClient.query("SELECT pg_try_advisory_lock($1) as locked", [ADVISORY_LOCK_ID]);
    if (!result.rows[0].locked) {
        console.error("[WORKER-CITAS] Lock de instancia ya está en uso; otro worker de citas está activo.");
        await lockClient.end();
        process.exit(2);
    }
    console.log("[WORKER-CITAS] Advisory lock adquirido (instancia única).");
}

async function releaseAdvisoryLock() {
    if (lockClient) {
        try {
            await lockClient.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]);
            console.log("[WORKER-CITAS] Advisory lock liberado.");
        } catch (err) {
            console.error("[WORKER-CITAS] Error liberando advisory lock:", err.message);
        } finally {
            try {
                await lockClient.end();
            } catch {
                // ignore
            }
            lockClient = null;
        }
    }
}

async function shutdown(signal) {
    console.log(`[WORKER-CITAS] Señal de terminación recibida (${signal}); liberando lock...`);
    await releaseAdvisoryLock();
    process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

/**
 * Un barredor que truena NO puede tumbar a los otros tres: el reloj de 48 h y
 * el autocierre son independientes. Se registra el error y se sigue; el job
 * termina en rojo solo si fallaron todos.
 */
async function correrBarredores(nombre, barredores) {
    const resultados = [];
    let fallas = 0;
    for (const [etiqueta, fn] of barredores) {
        try {
            const r = await fn();
            resultados.push(`${etiqueta}=${JSON.stringify(r)}`);
        } catch (err) {
            fallas += 1;
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[WORKER-CITAS] ${nombre}/${etiqueta} falló: ${msg}`);
            resultados.push(`${etiqueta}=ERROR`);
        }
    }
    console.log(`[WORKER-CITAS] ${nombre}: ${resultados.join(" · ")}`);
    if (fallas === barredores.length) {
        throw new Error(`[WORKER-CITAS] ${nombre}: fallaron los ${fallas} barredores`);
    }
    return { resultados, fallas };
}

async function start() {
    await acquireAdvisoryLock();
    await ensureStarted();

    // pg-boss ^12 exige la cola CREADA antes de agendar o trabajar: sin esto el
    // worker lanza "Queue ... not found" y `pi-citas` entra en bucle de
    // reinicio — con el monitor viéndolo verde. Es I-301 otra vez, y esta vez lo
    // habríamos puesto nosotros. `ensureQueue` es idempotente (queue.ts:52).
    await ensureQueue(COLA_MINUTO);
    await ensureQueue(COLA_DIARIO);

    await boss.schedule(COLA_MINUTO, CRON_CADA_5_MIN, {}, { tz: "America/Bogota" });
    await boss.schedule(COLA_DIARIO, CRON_DIARIO, {}, { tz: "America/Bogota" });
    console.log(`[WORKER-CITAS] Programado: ${COLA_MINUTO} (${CRON_CADA_5_MIN}) · ${COLA_DIARIO} (${CRON_DIARIO})`);

    await boss.work(COLA_MINUTO, async () =>
        correrBarredores(COLA_MINUTO, [
            ["recordatorios", () => barrerRecordatoriosDeCita()],
            ["recordatoriosExpediente", () => barrerRecordatoriosDeExpediente()],
            ["aviso48h", () => barrerAvisoVencimiento48h()],
            ["plazoPagoPadre", () => barrerPlazoPagoDelPadre()],
        ])
    );

    await boss.work(COLA_DIARIO, async () =>
        correrBarredores(COLA_DIARIO, [["autocierre", () => barrerAutocierre()]])
    );
}

start().catch((err) => {
    console.error("[WORKER-CITAS] Fatal:", err.message);
    process.exit(1);
});
