/**
 * SPEC-389 (Red de Profesionales · L2) — decisiones del worker de vencimiento.
 *
 * El worker corre periódicamente y hace **dos cosas**:
 *
 * 1. **Aviso a 30 días de vencer** — le manda un correo al profesional y al
 *    ADMIN. Idempotente: solo se manda una vez por `VerificacionProfesional`
 *    (`avisoVencimientoEnviadoEn` se sella en el mismo `UPDATE` que dispara
 *    el correo). Lección de **I-280** (30-08 · SPEC-387): sin idempotencia,
 *    dos runs del cron generan dos avisos al mismo profesional; anoche el
 *    mismo tipo de descuido mandó 1.894 correos en 24 h.
 *
 * 2. **Auto-vencimiento del perfil** — cuando la última verificación
 *    aprobada de un profesional se pasó de fecha y el perfil sigue `ACTIVO`,
 *    lo pasa a `VENCIDO`. Con eso el directorio abierto (L3) deja de
 *    mostrarlo (brief §5: "al vencer, el perfil deja de mostrarse").
 *
 * Este archivo es **puro** — no lee ni escribe BD ni red. Recibe el snapshot
 * de perfiles + verificaciones y devuelve la lista de acciones que el worker
 * debe ejecutar. La ejecución (transacciones Prisma, envío de mail) vive en
 * el `.mjs` del script, para que el test unitario cierre las reglas sin
 * cargar Prisma ni el motor de correo.
 */

export type AccionCron =
    | { tipo: "AVISAR_VENCIMIENTO"; verificacionId: string; perfilProfesionalId: string; venceEn: Date }
    | { tipo: "MARCAR_VENCIDO"; perfilProfesionalId: string; ultimaVerificacionId: string };

export interface PerfilCronInput {
    id: string;
    estado: "BORRADOR" | "EN_REVISION" | "ACTIVO" | "RECHAZADO" | "VENCIDO" | "SUSPENDIDO";
}

export interface VerificacionCronInput {
    id: string;
    perfilProfesionalId: string;
    resultado: "APROBADO" | "RECHAZADO" | "MAS_INFORMACION";
    revisadoEn: Date;
    venceEn: Date;
    avisoVencimientoEnviadoEn: Date | null;
}

const DIA_MS = 24 * 60 * 60 * 1000;
const VENTANA_AVISO_DIAS = 30; // Aviso el día 30 antes de vencer (± tolerancia del run).

/**
 * Núcleo puro. `ahora` se pasa por parámetro para que el test no dependa
 * del reloj real (y para poder simular ventanas de tiempo exactas).
 *
 * La ventana de aviso es `[ahora + 0, ahora + VENTANA_AVISO_DIAS)` — el
 * momento en que la verificación entra a "menos de 30 días para vencer" es
 * donde nace el aviso. Como el worker corre cada N minutos, la ventana solo
 * cierra el primer paso; los subsiguientes se saltan por
 * `avisoVencimientoEnviadoEn`.
 */
export function decidirAcciones(
    perfiles: readonly PerfilCronInput[],
    verificacionesPorPerfil: ReadonlyMap<string, readonly VerificacionCronInput[]>,
    ahora: Date,
): AccionCron[] {
    const acciones: AccionCron[] = [];
    const limiteAviso = new Date(ahora.getTime() + VENTANA_AVISO_DIAS * DIA_MS);

    for (const perfil of perfiles) {
        const verifs = verificacionesPorPerfil.get(perfil.id) ?? [];
        const aprobadas = verifs.filter((v) => v.resultado === "APROBADO");
        if (aprobadas.length === 0) continue;

        const ultima = aprobadas.reduce((mas, v) => (v.revisadoEn > mas.revisadoEn ? v : mas));

        // Rama 1: la última aprobada YA venció y el perfil sigue ACTIVO → marcar VENCIDO.
        if (ultima.venceEn.getTime() <= ahora.getTime()) {
            if (perfil.estado === "ACTIVO") {
                acciones.push({
                    tipo: "MARCAR_VENCIDO",
                    perfilProfesionalId: perfil.id,
                    ultimaVerificacionId: ultima.id,
                });
            }
            continue; // Un vencido no dispara aviso — ya pasó la ventana.
        }

        // Rama 2: cae en la ventana [ahora, ahora+30d) y no se ha enviado aviso aún.
        if (ultima.venceEn.getTime() < limiteAviso.getTime() && ultima.avisoVencimientoEnviadoEn === null) {
            acciones.push({
                tipo: "AVISAR_VENCIMIENTO",
                verificacionId: ultima.id,
                perfilProfesionalId: perfil.id,
                venceEn: ultima.venceEn,
            });
        }
    }

    return acciones;
}
