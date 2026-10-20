/**
 * SPEC-891 (IDOR) — Corrector QUIRÚRGICO e IDEMPOTENTE del parámetro `admin.expediente.etapas`:
 * mueve `contienePii`/`piiDetectada` de `campos` (ungated) a `camposGated`, SOLO en la etapa
 * `anonimizacion`. En BD fresca el seed ya nace gated → no-op; en prod (valor vivo con ambos en `campos`)
 * los mueve UNA vez. Re-ejecutar no cambia nada.
 *
 * SEGURIDAD: NO toca el cierre del IDOR. El leak ungated de la PII ya está 100% cerrado por CÓDIGO
 * (SPEC-891: los campos salieron de `disponibles` → `null`, y la `evaluacion` ya no filtra). Esto SOLO
 * restaura el revelado AUTORIZADO (gated + auditado) de la PII para quien tiene `expediente_revelar_original`.
 *
 * NO DESTRUCTIVO (lección I: idempotente ≠ no destructivo): opera sobre el JSON CRUDO, NO sobre
 * `parsearEtapasConfig` (que FILTRA/ORDENA/descarta campos). Preserva todas las demás etapas y todos los
 * demás campos de `anonimizacion` intactos; solo reescribe `campos`/`camposGated` de esa etapa. NO usa
 * `update: { valor }` a ciegas: lee el valor vivo (que PODRÍA estar personalizado por otra instancia vía
 * config/parametros/[clave]) y reescribe preservándolo.
 *
 * Uso (en el VPS, dentro del deploy):
 *   node --env-file=.env --import tsx scripts/limpieza/corregir-pii-gated-expediente.ts            # DRY-RUN
 *   node --env-file=.env --import tsx scripts/limpieza/corregir-pii-gated-expediente.ts --confirm  # aplica
 */
import { prisma } from "../../src/lib/prisma";
import { parseArgs, log } from "./_common";

const CLAVE = "admin.expediente.etapas";
const ETAPA = "anonimizacion";
const A_GATEAR: readonly string[] = ["contienePii", "piiDetectada"];

/**
 * Transforma el valor CRUDO (array de etapas). Puro, idempotente, no destructivo:
 * devuelve el mismo objeto-etapa cuando no hay nada que mover (otras etapas y la propia `anonimizacion`
 * ya-gated quedan por referencia, byte-idénticas al re-serializar).
 */
export function gatearPiiAnonimizacion(raw: unknown): { valor: unknown; cambiado: boolean } {
    if (!Array.isArray(raw)) return { valor: raw, cambiado: false };
    let cambiado = false;
    const valor = raw.map((etapa) => {
        if (typeof etapa !== "object" || etapa === null) return etapa;
        const e = etapa as Record<string, unknown>;
        if (e.clave !== ETAPA) return etapa;
        const campos = Array.isArray(e.campos) ? (e.campos as string[]) : [];
        const gated = Array.isArray(e.camposGated) ? (e.camposGated as string[]) : [];
        const enCampos = A_GATEAR.filter((f) => campos.includes(f));
        if (enCampos.length === 0) return etapa; // ya gated / ausentes → no-op (misma referencia)
        cambiado = true;
        return {
            ...e,
            campos: campos.filter((f) => !A_GATEAR.includes(f)),
            camposGated: [...gated, ...enCampos.filter((f) => !gated.includes(f))],
        };
    });
    return { valor, cambiado };
}

/** Lee el param vivo, aplica la transformación y —si `aplicar` y hubo cambio— lo reescribe. */
export async function corregirParametro(aplicar: boolean): Promise<{ existe: boolean; cambiado: boolean; aplicado: boolean }> {
    const param = await prisma.parametroSistema.findUnique({ where: { clave: CLAVE } });
    if (!param) {
        log("corregir-pii-gated", `parámetro "${CLAVE}" no existe — nada que corregir (no-op)`);
        return { existe: false, cambiado: false, aplicado: false };
    }
    let raw: unknown;
    try {
        raw = JSON.parse(param.valor);
    } catch {
        throw new Error(`"${CLAVE}" no es JSON válido — no se toca (revisar a mano)`);
    }
    const { valor, cambiado } = gatearPiiAnonimizacion(raw);
    if (!cambiado) {
        log("corregir-pii-gated", "no-op: contienePii/piiDetectada ya están en camposGated (o ausentes)");
        return { existe: true, cambiado: false, aplicado: false };
    }
    if (!aplicar) {
        log("corregir-pii-gated", "DRY-RUN: movería contienePii/piiDetectada a camposGated en 'anonimizacion'. Re-ejecutá con --confirm.");
        return { existe: true, cambiado: true, aplicado: false };
    }
    await prisma.parametroSistema.update({ where: { clave: CLAVE }, data: { valor: JSON.stringify(valor) } });
    log("corregir-pii-gated", "OK: contienePii/piiDetectada movidos a camposGated en 'anonimizacion'");
    return { existe: true, cambiado: true, aplicado: true };
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv, ["confirm"]);
    await corregirParametro(args.confirm === true);
}

if (process.argv[1]?.endsWith("corregir-pii-gated-expediente.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[corregir-pii-gated] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}
