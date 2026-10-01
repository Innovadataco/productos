/**
 * CANDADO · SPEC-835 · El resumen de omisiones del lote dice el MOTIVO, no solo el conteo — y `reps` se
 * PARTE en dos por ACCIÓN (NUESTRA vs PROFESIONAL). PURO (sin BD): `resumirOmisionesLote` y la derivación
 * `bucketDeRazon ∘ repsElegible` son funciones puras → corre como unit (sin psql). Afirma la FORMA de Diseño
 * (FORMA-SPEC835 v1.3 · 2eca1f1):
 *  · cobertura TOTAL (5 motivos simples + 2 buckets de `reps`), sin bucket «otras» (uno nuevo sin línea → rojo);
 *  · `vigencia` es del PERFIL, nunca del registro/REPS (el falso amigo de v1.1);
 *  · `reps`·NUESTRA sin trámite (NUNCA «renueve») vs `reps`·PROFESIONAL acción suya en el registro oficial
 *    (SÍ «REPS»/«registro», NUNCA «nuestro/sin trámite») — control por ACCIÓN, lockea el cruce;
 *  · el bucket se DERIVA de la razón ESTABLE de `repsElegible` (la misma función que omite): VENCIDA/modalidad
 *    → PROFESIONAL, SIN_VERIFICAR/envejecida → NUESTRA;
 *  · no culpa; voz usted (cero tú/voseo).
 */
import { describe, it, expect } from "vitest";
import {
    MOTIVOS_OMISION,
    BUCKETS_OMISION_REPS,
    bucketDeRazon,
    type MotivoOmision,
    type BucketOmisionReps,
    type ResultadoLote,
} from "./franjas.service";
import { resumirOmisionesLote } from "./resumen-omisiones";
import { repsElegible, type ConfigReps, type HechoReps } from "@/lib/profesional/reps/reps-elegibilidad";

type OmSpec = MotivoOmision | { motivo: "reps"; bucketReps: BucketOmisionReps };

/** Arma un `ResultadoLote` con `creadas` publicadas y una omisión por cada spec (reps lleva su bucket). */
function lote(creadas: number, specs: OmSpec[]): ResultadoLote {
    const inicio = "2027-03-10T10:00:00.000Z"; // irrelevante para el resumen (cuenta por motivo/bucket)
    return {
        creadas,
        omitidas: specs.map((s) =>
            typeof s === "string" ? { inicio, motivo: s } : { inicio, motivo: s.motivo, bucketReps: s.bucketReps },
        ),
    };
}

describe("SPEC-835 · resumen de omisiones del lote (copy + forma de Diseño v1.3)", () => {
    it("COBERTURA TOTAL: cada motivo simple y cada bucket de `reps` produce una línea no vacía (sin «otras»)", () => {
        for (const motivo of MOTIVOS_OMISION) {
            if (motivo === "reps") continue; // `reps` se cubre por bucket abajo
            const { lineas } = resumirOmisionesLote(lote(0, [motivo]));
            expect(lineas).toHaveLength(1);
            expect(lineas[0].motivo).toBe(motivo);
            expect(lineas[0].texto.trim().length).toBeGreaterThan(10);
            expect(lineas[0].texto).toContain("1");
        }
        for (const bucket of BUCKETS_OMISION_REPS) {
            const { lineas } = resumirOmisionesLote(lote(0, [{ motivo: "reps", bucketReps: bucket }]));
            expect(lineas).toHaveLength(1);
            expect(lineas[0].motivo).toBe("reps");
            expect(lineas[0].bucket).toBe(bucket);
            expect(lineas[0].texto.trim().length).toBeGreaterThan(10);
        }
    });

    it("NO «otras»: el resumen nunca emite un motivo fuera del conjunto cerrado", () => {
        const { lineas } = resumirOmisionesLote(
            lote(2, [...MOTIVOS_OMISION.filter((m) => m !== "reps"), { motivo: "reps", bucketReps: "NUESTRA" }]),
        );
        for (const l of lineas) expect(MOTIVOS_OMISION).toContain(l.motivo);
    });

    it("CONTROL POSITIVO: varios motivos → una línea por motivo con su conteo, orden estable", () => {
        const r = resumirOmisionesLote(lote(4, ["solape", "rango", "rango", "bloqueado", "rango", "solape"]));
        expect(r.publicadas).toBe(4);
        expect(r.omitidas).toBe(6);
        expect(r.intentadas).toBe(10);
        expect(r.lineas.map((l) => l.motivo)).toEqual(["rango", "bloqueado", "solape"]);
        expect(r.lineas.find((l) => l.motivo === "rango")!.n).toBe(3);
        expect(r.lineas.find((l) => l.motivo === "solape")!.n).toBe(2);
        expect(r.lineas.find((l) => l.motivo === "bloqueado")!.n).toBe(1);
    });

    it("ENCABEZADO: «Publicamos {publicadas} de {intentadas} horas. Estas {omitidas} no se publicaron:»", () => {
        const r = resumirOmisionesLote(lote(7, ["rango", "rango", "solape"]));
        expect(r.encabezado).toBe("Publicamos 7 de 10 horas. Estas 3 no se publicaron:");
    });

    it("`vigencia` habla del PERFIL, NUNCA del registro/REPS (falso amigo de v1.1)", () => {
        const [linea] = resumirOmisionesLote(lote(0, ["vigencia"])).lineas;
        expect(linea.texto).toContain("verificado su perfil");
        expect(linea.texto).toContain("re-verificación la hacemos nosotros");
        expect(linea.texto.toLowerCase()).not.toContain("reps");
        expect(linea.texto.toLowerCase()).not.toContain("registro");
        expect(linea.texto.toLowerCase()).not.toContain("inscripción");
    });

    it("`reps` PARTIDO por ACCIÓN: ambos buckets → DOS líneas; NUESTRA sin trámite, PROFESIONAL en el registro — sin cruce", () => {
        const r = resumirOmisionesLote(
            lote(0, [
                { motivo: "reps", bucketReps: "PROFESIONAL" },
                { motivo: "reps", bucketReps: "NUESTRA" },
                { motivo: "reps", bucketReps: "PROFESIONAL" },
            ]),
        );
        const reps = r.lineas.filter((l) => l.motivo === "reps");
        expect(reps).toHaveLength(2);
        const nuestra = reps.find((l) => l.bucket === "NUESTRA")!;
        const profesional = reps.find((l) => l.bucket === "PROFESIONAL")!;
        expect(nuestra.n).toBe(1);
        expect(profesional.n).toBe(2);
        // NUESTRA: es nuestro, sin trámite; NUNCA le pide renovar.
        expect(nuestra.texto).toContain("no tiene que hacer ningún trámite");
        expect(nuestra.texto.toLowerCase()).not.toContain("renuév");
        // PROFESIONAL: acción suya en el REGISTRO OFICIAL; SÍ nombra REPS/registro; NUNCA «nuestro / sin trámite».
        expect(profesional.texto).toContain("registro oficial");
        expect(profesional.texto.toLowerCase()).toContain("reps");
        expect(profesional.texto.toLowerCase()).not.toContain("nuestro");
        expect(profesional.texto.toLowerCase()).not.toContain("trámite");
    });

    it("NO CULPA + VOZ USTED: ninguna línea reprocha ni usa tú/voseo", () => {
        const { lineas, encabezado } = resumirOmisionesLote(
            lote(1, [
                ...MOTIVOS_OMISION.filter((m) => m !== "reps"),
                { motivo: "reps", bucketReps: "NUESTRA" },
                { motivo: "reps", bucketReps: "PROFESIONAL" },
            ]),
        );
        const textos = [encabezado, ...lineas.map((l) => l.texto)];
        const todo = lineas.map((l) => l.texto).join(" ");
        for (const v of ["elija", "actívela", "publique", "desbloquéelos", "muévalas", "renuévela", "actualícela"]) {
            expect(todo).toContain(v);
        }
        for (const t of textos) {
            const lower = ` ${t.toLowerCase()} `;
            // Voseo (morfología imperativa -á/-é/-í) de los verbos usados + pronombres informales.
            for (const voseo of ["elegí", "activá", "publicá", "desbloqueá", "mové", "renová", "renovala", "actualizá", "volvé"]) {
                expect(lower).not.toContain(voseo);
            }
            expect(lower).not.toContain(" tú ");
            expect(lower).not.toContain(" vos ");
            for (const culpa of ["usted se equivocó", "su error", "por su culpa"]) {
                expect(lower).not.toContain(culpa);
            }
        }
    });
});

describe("SPEC-835 · el bucket se DERIVA de la razón estable de repsElegible (la misma función que omite)", () => {
    const config: ConfigReps = { ventanaVerificacionDias: 365, exigirRepsVerificado: false };
    const now = new Date("2027-03-10T10:00:00.000Z");
    const futuro = new Date("2027-12-31T00:00:00.000Z");

    it("VENCIDA → PROFESIONAL (su renovación en el registro)", () => {
        const hecho: HechoReps = { resultado: "VENCIDA", verificadoEn: now, vigenteHasta: null, modalidades: [] };
        const e = repsElegible(hecho, "TELEMEDICINA", config, now);
        expect(e.elegible).toBe(false);
        expect(bucketDeRazon(e.razon)).toBe("PROFESIONAL");
    });

    it("MODALIDAD no cubierta (REPS vigente, otra modalidad) → PROFESIONAL", () => {
        const hecho: HechoReps = { resultado: "VIGENTE", verificadoEn: now, vigenteHasta: futuro, modalidades: ["PRESENCIAL"] };
        const e = repsElegible(hecho, "TELEMEDICINA", config, now);
        expect(e.elegible).toBe(false);
        expect(bucketDeRazon(e.razon)).toBe("PROFESIONAL");
    });

    it("SIN_VERIFICAR con cutover CERRADO → omite y cae en NUESTRA (sin trámite)", () => {
        const e = repsElegible(null, "TELEMEDICINA", { ...config, exigirRepsVerificado: true }, now);
        expect(e.elegible).toBe(false);
        expect(bucketDeRazon(e.razon)).toBe("NUESTRA");
    });

    it("NUESTRA verificación envejecida (VIGENTE, ventana vencida) → NUESTRA", () => {
        const viejo = new Date("2025-01-01T00:00:00.000Z"); // > 365 días antes de `now`
        const hecho: HechoReps = { resultado: "VIGENTE", verificadoEn: viejo, vigenteHasta: futuro, modalidades: ["TELEMEDICINA"] };
        const e = repsElegible(hecho, "TELEMEDICINA", config, now);
        expect(e.elegible).toBe(false);
        expect(bucketDeRazon(e.razon)).toBe("NUESTRA");
    });

    it("CONTROL NEGATIVO: al día + modalidad cubierta → elegible (no se omite)", () => {
        const hecho: HechoReps = { resultado: "VIGENTE", verificadoEn: now, vigenteHasta: futuro, modalidades: ["TELEMEDICINA"] };
        expect(repsElegible(hecho, "TELEMEDICINA", config, now).elegible).toBe(true);
    });
});
