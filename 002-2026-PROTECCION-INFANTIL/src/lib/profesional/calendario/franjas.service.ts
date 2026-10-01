/**
 * SPEC-714 · Materializar franjas en LOTE (repetir un patrón, copiar un día).
 *
 * v1 sin modelo de series: «cada martes» / «lun-vie» / «copiar día» se traducen
 * a filas `FranjaDisponible` concretas. Cada una pasa por las MISMAS cuatro
 * reglas del servidor que la creación unitaria (`franjas/route.ts`): modalidad
 * que atiende, `fin>inicio`, muro de vigencia (`fin<=venceEn`) y no-solape. Las
 * que no caben **no se crean** y se dice cuántas sí (forma de Diseño: «las que no
 * caben, no se crean»). Todo en UNA unidad de trabajo: o se valida el lote
 * completo con la agenda coherente, o no se escribe nada a medias.
 *
 * El no-solape se evalúa contra la agenda dentro de la tx, así que dos entradas
 * del mismo lote que se pisen entre sí también se detectan (la primera se crea y
 * la segunda se omite por solape). Se ordenan por inicio para que sea determinista.
 */
import { AppError, ERROR_CODES } from "@/lib/errors";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { FranjaDisponibleRepository } from "@/lib/dal/repositories/franja-disponible";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { DiaBloqueadoRepository } from "@/lib/dal/repositories/dia-bloqueado";
import { diaBogota } from "@/lib/fechas/formato-bogota";
import { modalidadRepsRequerida } from "@/lib/profesional/reps/modalidad-cita-a-reps";
import type { RazonReps } from "@/lib/profesional/reps/reps-elegibilidad";

export interface FranjaLoteInput {
    inicio: string; // ISO UTC
    fin: string; // ISO UTC
    modalidad: "VIRTUAL" | "PRESENCIAL";
}

/**
 * Los motivos por los que una franja del lote NO se publica. Runtime-enumerable (no un type suelto):
 * así el candado del resumen (SPEC-835) y el `Record` de copy cazan un motivo NUEVO sin línea en vez de
 * confiar en una lista escrita a mano (mismo patrón que `ESTADOS_REPS`). `reps` entró con 825; el conjunto
 * quedó FINAL (FORMA-SPEC835 v1.2). `vigencia` = NUESTRA verificación del PERFIL (venceEnVigente), NO el
 * REPS; `reps` = cobertura REPS de la modalidad (fundido `¬esRepsElegibleParaModalidad`).
 */
export const MOTIVOS_OMISION = ["rango", "modalidad", "vigencia", "bloqueado", "solape", "reps"] as const;
export type MotivoOmision = (typeof MOTIVOS_OMISION)[number];

/**
 * SPEC-835 · El motivo `reps` fusiona causas con ACCIONES OPUESTAS (`¬esRepsElegibleParaModalidad` funde
 * VENCIDA/modalidad/envejecida/…). El resumen del lote lo parte en DOS buckets POR ACCIÓN, derivados de la
 * `razon` ESTABLE de `repsElegible` (la MISMA función que omite — no se reimplementa, no se lee el motivo-string):
 *  · `NUESTRA`     — no cargamos/encontramos su verificación, o la nuestra envejeció → «es nuestro, sin trámite».
 *  · `PROFESIONAL` — su registro venció o no cubre la modalidad que ofrece → «renueve/actualice» (acción suya).
 * Orden = el de la FORMA (NUESTRA antes que PROFESIONAL). Runtime-enumerable + `Record` exhaustivo: una razón
 * o un bucket nuevo rompe el build, no cae en silencio.
 */
export const BUCKETS_OMISION_REPS = ["NUESTRA", "PROFESIONAL"] as const;
export type BucketOmisionReps = (typeof BUCKETS_OMISION_REPS)[number];

const BUCKET_POR_RAZON: Record<RazonReps, BucketOmisionReps> = {
    VENCIDA: "PROFESIONAL", // el registro caducó → él renueva (como CADUCADO)
    VIGENCIA_PASADA: "PROFESIONAL", // la vigencia de la autoridad ya pasó → él renueva
    MODALIDAD_NO_CUBIERTA: "PROFESIONAL", // ofrece una modalidad que su REPS no cubre → él actualiza o deja de ofrecerla
    SIN_VERIFICAR: "NUESTRA", // aún no cargamos su verificación (muerde al cerrar el cutover) → nuestro
    NO_ENCONTRADA: "NUESTRA", // no lo encontramos en el registro → revisión nuestra
    SIN_FECHA_VIGENCIA: "NUESTRA", // borde fail-closed (VIGENTE sin fecha) → revisión nuestra
    NUESTRA_VERIFICACION_VIEJA: "NUESTRA", // nuestro re-chequeo envejeció → re-verificamos nosotros
    RELOJ_INVALIDO: "NUESTRA", // condición interna → nuestro
    AL_DIA: "NUESTRA", // elegible: NO se omite. Defensivo (el Record exige todas las razones); nunca llega acá.
};

/** SPEC-835 · Bucket de ACCIÓN de una omisión `reps`, derivado de la razón estable de `repsElegible`. */
export function bucketDeRazon(razon: RazonReps): BucketOmisionReps {
    return BUCKET_POR_RAZON[razon];
}

export interface ResultadoLote {
    creadas: number;
    /** `bucketReps` se setea SOLO cuando `motivo === "reps"` (el bucket de acción; ver [[bucketDeRazon]]). */
    omitidas: { inicio: string; motivo: MotivoOmision; bucketReps?: BucketOmisionReps }[];
}

export async function materializarFranjas(
    perfilId: string,
    entradas: FranjaLoteInput[],
): Promise<ResultadoLote> {
    return withUnitOfWork(async (tx) => {
        const perfilRepo = new PerfilProfesionalRepository(tx);
        const perfil = await perfilRepo.findPorId(perfilId);
        if (!perfil) throw new AppError("Perfil profesional no existe", ERROR_CODES.NOT_FOUND, 404);
        const venceEn = await perfilRepo.venceEnVigente(perfilId);
        if (!venceEn) {
            throw new AppError(
                "Necesita una verificación aprobada para publicar disponibilidad",
                ERROR_CODES.VALIDATION_ERROR,
                400,
            );
        }
        // SPEC-825 · CINTURÓN de creación: no se publica una modalidad que el REPS del profesional no cubre
        // (imposibilidad estructural: el estado malo no nace). COMPLEMENTA el filtro de lectura (pieza 1), no lo
        // reemplaza — la validez REPS caduca por tiempo, así que la LECTURA también filtra siempre. Se evalúa
        // una vez por eje antes del lote (no N consultas).
        const ahoraReps = new Date();
        // SPEC-835: evaluamos la ELEGIBILIDAD COMPLETA (con `razon`) por eje, no solo el booleano — la razón
        // bucketiza la omisión `reps` por acción (profesional / nuestra) sin reimplementar la decisión.
        const repsVirtual = await perfilRepo.evaluarRepsParaModalidad(perfilId, "TELEMEDICINA", ahoraReps);
        const repsPresencial = await perfilRepo.evaluarRepsParaModalidad(perfilId, "PRESENCIAL", ahoraReps);
        const repo = new FranjaDisponibleRepository(tx);
        const diasRepo = new DiaBloqueadoRepository(tx);
        const omitidas: ResultadoLote["omitidas"] = [];
        let creadas = 0;

        const ordenadas = [...entradas].sort((a, b) => a.inicio.localeCompare(b.inicio));
        for (const e of ordenadas) {
            const inicio = new Date(e.inicio);
            const fin = new Date(e.fin);
            if (fin.getTime() <= inicio.getTime()) {
                omitidas.push({ inicio: e.inicio, motivo: "rango" });
                continue;
            }
            if (e.modalidad === "VIRTUAL" && !perfil.atiendeVirtual) {
                omitidas.push({ inicio: e.inicio, motivo: "modalidad" });
                continue;
            }
            if (e.modalidad === "PRESENCIAL" && !perfil.atiendePresencial) {
                omitidas.push({ inicio: e.inicio, motivo: "modalidad" });
                continue;
            }
            // SPEC-825 · el REPS debe cubrir la modalidad de la franja (telemedicina↔virtual, presencial↔presencial).
            // Sin cobertura no se crea: la reserva la rechazaría igual, y el display (pieza 1) no la ofrecería.
            const repsReps = modalidadRepsRequerida(e.modalidad);
            const repsEval = repsReps === "TELEMEDICINA" ? repsVirtual : repsReps === "PRESENCIAL" ? repsPresencial : null;
            if (!repsEval || !repsEval.elegible) {
                // SPEC-835: la omisión `reps` lleva su bucket de ACCIÓN (derivado de la razón estable). Sin eje
                // mapeable (no debería pasar con VIRTUAL/PRESENCIAL) → NUESTRA, fail-safe sin culpar al profesional.
                omitidas.push({ inicio: e.inicio, motivo: "reps", bucketReps: repsEval ? bucketDeRazon(repsEval.razon) : "NUESTRA" });
                continue;
            }
            if (fin.getTime() > venceEn.getTime()) {
                omitidas.push({ inicio: e.inicio, motivo: "vigencia" });
                continue;
            }
            // SPEC-714 · misma regla que la creación unitaria (franjas/route.ts): no se publica
            // en un día que el profesional cerró. Sin esto, repetir/copiar sería la puerta hermana.
            if (await diasRepo.estaBloqueado(perfilId, diaBogota(inicio))) {
                omitidas.push({ inicio: e.inicio, motivo: "bloqueado" });
                continue;
            }
            if (await repo.existeSolapada(perfilId, inicio, fin)) {
                omitidas.push({ inicio: e.inicio, motivo: "solape" });
                continue;
            }
            await repo.crear({
                profesional: { connect: { id: perfilId } },
                inicio,
                fin,
                modalidad: e.modalidad,
                tomada: false,
            });
            creadas++;
        }
        return { creadas, omitidas };
    });
}
