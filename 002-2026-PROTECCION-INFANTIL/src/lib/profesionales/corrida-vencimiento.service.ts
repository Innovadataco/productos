/**
 * SPEC-449 (I-313) · el reloj de la verificación, ejecutado.
 *
 * `decidirAcciones` (`cron-vencimiento.ts:56`) decide qué hacer y estaba escrito
 * y probado desde SPEC-389 — **sin un solo llamador**. Este archivo es lo que
 * faltaba: leer los perfiles, pedirle la decisión y **aplicarla**.
 *
 * Consecuencia de que no existiera: nada en todo el árbol escribía
 * `estado = "VENCIDO"`, así que un profesional cuyos antecedentes caducaron
 * seguía en el directorio del padre **para siempre**. La Ley 2375/2024 obliga a
 * revalidar cada 4 meses.
 *
 * **Por qué la ejecución vive acá y no en el `.mjs`:** el molde de la casa
 * (`worker-vigencia-pagos.mjs` + `pagos/vigencia.service.ts`) deja el `.mjs`
 * como cáscara —lock, cola, cron, logging— y la lógica del lado testeable. El
 * comentario de cabecera de `cron-vencimiento.ts` dice lo contrario; está
 * desactualizado respecto del molde real.
 *
 * **Imports relativos a propósito** (SPEC-197 · I-88): este módulo entra en la
 * cadena de un worker `.mjs`, y ahí el alias `@/lib` no resuelve.
 */
import { VerificadorRepository } from "../dal/repositories/verificador-repository";
import { decidirAcciones, type VerificacionCronInput } from "./cron-vencimiento";
import { programar, despacharEnvios } from "../notificaciones/motor";
import { logger } from "../logger";

export const EVENTO_AVISO_VENCIMIENTO = "profesional.verificacion.por_vencer";

export interface ResultadoCorrida {
    /** Perfiles que pasaron a `VENCIDO` en esta corrida. */
    vencidos: number;
    /** Avisos de «te vence pronto» efectivamente programados. */
    avisados: number;
    /** Acciones que no se pudieron aplicar. Si es > 0 la corrida FALLA. */
    errores: number;
    /** Acciones que otra corrida ya había aplicado (CAS en 0). No son error. */
    yaAplicadas: number;
}

/**
 * Corre el reloj una vez.
 *
 * **Falla ruidosamente:** si alguna acción no se pudo aplicar, lanza. Un reloj
 * que se traga sus errores y termina «bien» es exactamente la degradación
 * silenciosa que esta spec viene a cerrar — el monitor lo vería verde mientras
 * los perfiles vencidos siguen publicados.
 */
export async function ejecutarCorridaVencimiento(ahora: Date = new Date()): Promise<ResultadoCorrida> {
    const repo = new VerificadorRepository();
    const perfiles = await repo.perfilesParaCorridaDeVencimiento();

    const porPerfil = new Map<string, VerificacionCronInput[]>();
    for (const p of perfiles) {
        porPerfil.set(p.id, p.verificaciones);
    }

    const acciones = decidirAcciones(
        perfiles.map((p) => ({ id: p.id, estado: p.estado })),
        porPerfil,
        ahora,
    );

    const resultado: ResultadoCorrida = { vencidos: 0, avisados: 0, errores: 0, yaAplicadas: 0 };

    for (const accion of acciones) {
        try {
            if (accion.tipo === "MARCAR_VENCIDO") {
                const escrito = await repo.marcarVencidoSiActivo(accion.perfilProfesionalId);
                if (escrito) resultado.vencidos++;
                else resultado.yaAplicadas++;
                continue;
            }

            // AVISAR_VENCIMIENTO — se sella ANTES de programar el correo, con
            // CAS: si dos corridas se cruzan, solo una pasa el sello y solo una
            // manda el aviso. Sellar después dejaría la ventana para dos correos.
            const sellado = await repo.marcarAvisoVencimientoEnviado(accion.verificacionId, ahora);
            if (!sellado) {
                resultado.yaAplicadas++;
                continue;
            }
            const enviado = await avisarPorVencer(accion.perfilProfesionalId, accion.venceEn);
            if (enviado) resultado.avisados++;
        } catch (err) {
            resultado.errores++;
            logger.error("[SPEC-449] No se pudo aplicar una acción del reloj de vencimiento", {
                accion: accion.tipo,
                perfilProfesionalId: accion.perfilProfesionalId,
                error: err instanceof Error ? err.message : err,
            });
        }
    }

    if (resultado.errores > 0) {
        throw new Error(
            `[SPEC-449] La corrida terminó con ${resultado.errores} acción(es) fallida(s) de ${acciones.length}`,
        );
    }
    return resultado;
}

/**
 * El aviso al profesional, **antes** de que venza y no el día después.
 * Plantilla y regla viven sembradas: el admin edita el texto sin desplegar.
 */
async function avisarPorVencer(perfilProfesionalId: string, venceEn: Date): Promise<boolean> {
    const repo = new VerificadorRepository();
    const perfil = await repo.obtenerFicha(perfilProfesionalId);
    const usuarioId = perfil?.usuarioId;
    if (!usuarioId) return false;

    const r = await programar({
        evento: EVENTO_AVISO_VENCIMIENTO,
        sujetoTipo: "PerfilProfesional",
        sujetoId: perfilProfesionalId,
        destinatarios: [
            {
                usuarioId,
                rol: "PROFESIONAL",
                variables: { venceEn: venceEn.toISOString() },
            },
        ],
    });
    await despacharEnvios(r.envios ?? []);
    return r.programadas > 0;
}
