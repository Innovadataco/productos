/**
 * SPEC-835 · El resumen de omisiones del LOTE: dice el MOTIVO, no solo cuántas.
 *
 * Origen (hallazgo de Diseño, radicado 835): al crear franjas en lote la pantalla hoy SOLO cuenta las
 * omitidas («N no cupieron») — el mismo límite silencioso que la puerta unitaria (834) y peor: en lote
 * se pierden diez y el profesional recibe un número que no le dice NADA, y vuelve a publicar al vacío.
 *
 * SIETE líneas en pantalla: cinco motivos simples + `reps` PARTIDO en DOS por ACCIÓN (NUESTRA / PROFESIONAL),
 * porque `reps` (`¬esRepsElegibleParaModalidad`) fusiona causas con acciones OPUESTAS — el 2.º colapso que 835
 * deshace, medido por Datos (v1.3). PURO (sin Prisma, sin DB): mapea el `ResultadoLote` de `materializarFranjas`
 * a un encabezado + una línea por motivo con `n>0`. Copy VERBATIM de Diseño (FORMA-SPEC835 v1.3 · 2eca1f1).
 * Voz usted.
 *
 * EL CANDADO VIVE EN EL TIPO: `Record<Exclude<MotivoOmision,"reps">,…>` (cinco simples) + `Record<BucketOmisionReps,…>`
 * (los dos buckets de `reps`) obligan a que CADA motivo y CADA bucket tenga su línea — un valor nuevo sin línea NO
 * compila. Es lo que impide que el próximo motivo/bucket «entre muerto». NO hay bucket «otras».
 */
import {
    MOTIVOS_OMISION,
    BUCKETS_OMISION_REPS,
    type MotivoOmision,
    type BucketOmisionReps,
    type ResultadoLote,
} from "./franjas.service";

export interface LineaResumenOmision {
    readonly motivo: MotivoOmision;
    /** Solo en las líneas de `reps` (partido por acción): cuál bucket. */
    readonly bucket?: BucketOmisionReps;
    readonly n: number;
    /** Copy verbatim de Diseño con el conteo ya interpolado (voz usted). */
    readonly texto: string;
}

export interface ResumenOmisionesLote {
    readonly publicadas: number;
    readonly intentadas: number;
    readonly omitidas: number;
    /** Encabezado (voz usted), verbatim de Diseño. Solo tiene sentido mostrarlo con `omitidas > 0`. */
    readonly encabezado: string;
    /** Una línea por motivo (y por bucket de `reps`) con `n>0`, en orden estable. Vacío si no hubo omisiones. */
    readonly lineas: readonly LineaResumenOmision[];
}

// Copy VERBATIM de Diseño (FORMA-SPEC835 v1.3 · 2eca1f1). El `Record` SIN `reps` (ese se parte por bucket)
// es el candado de exhaustividad de los motivos simples: uno nuevo sin entrada rompe `tsc`.
const LINEA_SIMPLE: Record<Exclude<MotivoOmision, "reps">, (n: number) => string> = {
    rango: (n) => `${n} quedaron fuera del rango de fechas u horas permitido — elija otra fecha u hora.`,
    modalidad: (n) => `${n} en una modalidad que no atiende — actívela en su perfil, o quite esas horas.`,
    // `vigencia` = NUESTRA verificación interna del PERFIL (venceEnVigente), NO el REPS. PROHIBIDO decir
    // «REPS»/«registro» acá (el falso amigo de v1.1); eje PERFIL, no registro.
    vigencia: (n) =>
        `${n} quedan más allá de la fecha hasta la que tenemos verificado su perfil — publique dentro de esa ventana ya; la re-verificación la hacemos nosotros.`,
    bloqueado: (n) => `${n} en días que usted tiene bloqueados — desbloquéelos para publicarlas.`,
    solape: (n) => `${n} que se cruzan con horas que ya tiene — muévalas a otro momento.`,
};

// `reps` PARTIDO en dos por ACCIÓN (v1.3 · 2eca1f1). NUESTRA (sin trámite; NUNCA «renueve usted») vs
// PROFESIONAL (acción SUYA en el registro oficial; SÍ dice «REPS»/«registro»; NUNCA «es algo nuestro / sin
// trámite»). Opuesto a `vigencia`, que es el PERFIL interno y jamás nombra el registro. El candado lockea el cruce.
const LINEA_REPS_POR_BUCKET: Record<BucketOmisionReps, (n: number) => string> = {
    NUESTRA: (n) =>
        `${n} mientras no confirmemos su inscripción en el registro — su oferta entra cuando la confirmemos. Es algo nuestro: no tiene que hacer ningún trámite.`,
    PROFESIONAL: (n) =>
        `${n} por su inscripción en el registro (REPS) — renuévela o actualícela en el registro oficial (para que esté vigente y cubra esa modalidad) y vuelva a publicar esas franjas.`,
};

export function resumirOmisionesLote(resultado: ResultadoLote): ResumenOmisionesLote {
    const { creadas, omitidas } = resultado;
    const intentadas = creadas + omitidas.length;

    const conteoSimple = new Map<Exclude<MotivoOmision, "reps">, number>();
    const conteoReps = new Map<BucketOmisionReps, number>();
    for (const o of omitidas) {
        if (o.motivo === "reps") {
            // `reps` SIEMPRE trae bucket desde materializarFranjas; `?? "NUESTRA"` es fail-safe sin culpa.
            const bucket = o.bucketReps ?? "NUESTRA";
            conteoReps.set(bucket, (conteoReps.get(bucket) ?? 0) + 1);
        } else {
            conteoSimple.set(o.motivo, (conteoSimple.get(o.motivo) ?? 0) + 1);
        }
    }

    // Orden estable: el canónico de MOTIVOS_OMISION; al llegar a `reps`, sus buckets en el orden de la FORMA.
    const lineas: LineaResumenOmision[] = [];
    for (const motivo of MOTIVOS_OMISION) {
        if (motivo === "reps") {
            for (const bucket of BUCKETS_OMISION_REPS) {
                const n = conteoReps.get(bucket) ?? 0;
                if (n > 0) lineas.push({ motivo: "reps", bucket, n, texto: LINEA_REPS_POR_BUCKET[bucket](n) });
            }
        } else {
            const n = conteoSimple.get(motivo) ?? 0;
            if (n > 0) lineas.push({ motivo, n, texto: LINEA_SIMPLE[motivo](n) });
        }
    }

    return {
        publicadas: creadas,
        intentadas,
        omitidas: omitidas.length,
        encabezado: `Publicamos ${creadas} de ${intentadas} horas. Estas ${omitidas.length} no se publicaron:`,
        lineas,
    };
}
