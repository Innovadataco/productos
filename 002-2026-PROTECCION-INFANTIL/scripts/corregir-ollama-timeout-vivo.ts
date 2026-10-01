/**
 * SPEC-812 (pieza 3) · Corrector del VALOR VIVO de `ia.ollama.timeout_ms`.
 *
 * La semilla bajó el default a 60000 SOLO para entornos nuevos: el loop de `defaults` del seed usa
 * upsert con `update: {}` (anti-I-100), así que re-sembrar NUNCA pisa una fila existente — la fila viva
 * en prod se queda en 120000 (causa raíz de I-100). Bajar el valor vivo no se hace a mano ni con un
 * UPDATE crudo: se hace por el SERVICIO de configuración, que deja AUDITORÍA.
 *
 * Como el script NO tiene sesión (lo corre el CEO desde el contenedor), el actor va en NULL a propósito
 * —un Usuario fabricado para satisfacer el FK sería una mentira con forma de dato— y la responsabilidad
 * del HECHO queda en el AuditLog por `motivo` (obligatorio). Eso lo garantiza
 * `ConfiguracionService.actualizarComoCorrectorOperativo`, cuyo candado prueba que la API HTTP, en
 * cambio, sigue exigiendo actor no-nulo (configuracion-corrector.candado).
 *
 * DRY-RUN por defecto (solo lee e imprime); `--confirm` aplica. Idempotente: si ya está en 60000 o si
 * el parámetro no existe (entorno nuevo donde el seed ya lo dejó bien), no escribe nada. ABORTA ante un
 * flag desconocido (`parseArgs`).
 *
 * Uso: node --import tsx scripts/corregir-ollama-timeout-vivo.ts [--confirm]
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { ConfiguracionService } from "../src/lib/dal/services/configuracion";
import { parseArgs } from "./limpieza/_common";

const CLAVE_TIMEOUT = "ia.ollama.timeout_ms";
const OBJETIVO = "60000";
const MOTIVO =
    "SPEC-812 (pieza 3): baja operativa del timeout de generación de Ollama de 120000 a 60000. " +
    "Higiene, no defecto: con la derivación del dataset en segundo plano (SPEC-807) nadie espera el bloqueo, " +
    "y nuestra propia vigilancia ya declara 60 s como falla de Ollama (monitoreo.ollama.smoke.timeout_ms=60000). " +
    "Corrido por el CEO desde el contenedor (script sin sesión); actor null por diseño, rastro en este motivo.";

export interface ResultadoTimeout {
    /** Valor vivo leído antes de actuar; null si el parámetro no existe en esta BD. */
    valorActual: string | null;
    objetivo: string;
    yaEnObjetivo: boolean;
    /** true solo si esta corrida escribió el cambio (por el servicio, auditado). */
    escrito: boolean;
}

/**
 * Lee el valor vivo de `ia.ollama.timeout_ms` y, si difiere del objetivo y existe, lo baja a 60000
 * POR EL SERVICIO (actor null + motivo, auditado). No crea el parámetro si falta: sembrarlo es del
 * seed, no de un corrector de valor vivo.
 */
export async function corregirTimeoutOllamaVivo(
    db: PrismaClient,
    opts: { dryRun: boolean },
): Promise<ResultadoTimeout> {
    const fila = await db.parametroSistema.findUnique({
        where: { clave: CLAVE_TIMEOUT },
        select: { valor: true },
    });
    const valorActual = fila?.valor ?? null;
    const yaEnObjetivo = valorActual === OBJETIVO;

    // Nada que hacer: dry-run, ya en objetivo, o el parámetro no existe (no lo creamos acá).
    if (opts.dryRun || yaEnObjetivo || valorActual === null) {
        return { valorActual, objetivo: OBJETIVO, yaEnObjetivo, escrito: false };
    }

    await new ConfiguracionService().actualizarComoCorrectorOperativo(CLAVE_TIMEOUT, { valor: OBJETIVO }, MOTIVO);
    return { valorActual, objetivo: OBJETIVO, yaEnObjetivo: false, escrito: true };
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv, ["confirm"]);
    const confirm = args.confirm === true;
    console.log(
        `[corregir-timeout-ollama] modo: ${confirm ? "APLICAR (--confirm)" : "DRY-RUN (sin --confirm, no se escribe nada)"}`,
    );
    const r = await corregirTimeoutOllamaVivo(prisma, { dryRun: !confirm });

    if (r.valorActual === null) {
        console.log(
            `[corregir-timeout-ollama] ${CLAVE_TIMEOUT} NO existe en esta BD (en entornos nuevos lo siembra el seed en 60000). Nada que corregir.`,
        );
        return;
    }
    console.log(
        `[corregir-timeout-ollama] valor vivo=${r.valorActual} · objetivo=${r.objetivo} · ya en objetivo=${r.yaEnObjetivo}`,
    );
    if (r.yaEnObjetivo) {
        console.log("[corregir-timeout-ollama] Ya está en 60000. Nada que hacer (idempotente).");
        return;
    }
    if (confirm) {
        console.log(
            `[corregir-timeout-ollama] Corregido ${r.valorActual} → ${r.objetivo} por el servicio (actor null + motivo, auditado en AuditLog).`,
        );
    } else {
        console.log(
            `[corregir-timeout-ollama] DRY-RUN: cambiaría ${r.valorActual} → ${r.objetivo}. Corré con --confirm para aplicar.`,
        );
    }
}

if (
    process.argv[1]?.endsWith("corregir-ollama-timeout-vivo.ts") ||
    process.argv[1]?.endsWith("corregir-ollama-timeout-vivo.js")
) {
    main()
        .catch((e) => {
            console.error(e instanceof Error ? e.message : e);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
