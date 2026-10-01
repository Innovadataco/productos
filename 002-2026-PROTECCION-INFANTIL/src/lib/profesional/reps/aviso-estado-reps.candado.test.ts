/**
 * CANDADO · SPEC-813 — la clasificación del estado REPS para el aviso al profesional.
 *
 * `¬repsAlDia` funde CUATRO causas (medido en la tabla de readiness). Este candado prueba que:
 *  · el aviso al PROFESIONAL sale SOLO con el CADUCADO explícito (4 `VENCIDA`, 6 `VIGENTE`+vigencia pasada);
 *  · los estados 5 (`NO_ENCONTRADA`), 7 (nuestro re-chequeo venció, autoridad aún vigente) y 8 (`VIGENTE`
 *    sin fecha) van a `REVISION_ADMIN`, NO al profesional. El punto que un «VENCIDA dispara» NO probaría
 *    es justamente que el **7 NO dispara** — la autoridad lo da por vigente; el problema es nuestro.
 *
 * Discrimina por HECHO + RELOJES, no por el `motivo`: 6, 7 y 8 comparten `estado=VIGENTE` en el motor
 * (`repsElegible`) y se separan sólo por los relojes — se prueba abajo que así es. Control positivo por
 * MUTACIÓN de UN campo (cierra/abre por esa razón, no de rebote). Y queda ATADO POR CONDUCTA a
 * `repsElegible(..., modalidad=null)` para que las dos piezas no deriven en silencio.
 *
 * PURO (sin base): todo es la derivación.
 */
import { describe, it, expect } from "vitest";
import {
    clasificarAvisoReps,
    debeMostrarAvisoCaducadoReps,
    requiereRevisionAdminReps,
    CLASIFICACIONES_AVISO_REPS,
    type ClasificacionAvisoReps,
} from "./aviso-estado-reps";
import { repsElegible, ESTADOS_REPS, type HechoReps, type ConfigReps } from "./reps-elegibilidad";

const DIA = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-06-15T12:00:00Z");
const EXIGE: ConfigReps = { ventanaVerificacionDias: 365, exigirRepsVerificado: true };
const CUTOVER: ConfigReps = { ventanaVerificacionDias: 365, exigirRepsVerificado: false };

/** VIGENTE al día: verificado hace poco, autoridad vigente al futuro, cubre ambas modalidades. */
const VIGENTE_AL_DIA: HechoReps = {
    resultado: "VIGENTE",
    verificadoEn: new Date(NOW.getTime() - 10 * DIA),
    vigenteHasta: new Date(NOW.getTime() + 200 * DIA),
    modalidades: ["TELEMEDICINA", "PRESENCIAL"],
};

// Los 8 estados medidos (modalidad es irrelevante acá: la clasificación es vigencia-only).
const ESTADO_1_SIN_FILA: HechoReps | null = null;
const ESTADO_2_SIN_VERIFICAR: HechoReps = { ...VIGENTE_AL_DIA, resultado: "SIN_VERIFICAR" };
const ESTADO_3_AL_DIA: HechoReps = VIGENTE_AL_DIA;
const ESTADO_4_VENCIDA: HechoReps = { ...VIGENTE_AL_DIA, resultado: "VENCIDA" };
const ESTADO_5_NO_ENCONTRADA: HechoReps = { ...VIGENTE_AL_DIA, resultado: "NO_ENCONTRADA" };
const ESTADO_6_VIGENCIA_PASADA: HechoReps = { ...VIGENTE_AL_DIA, vigenteHasta: new Date(NOW.getTime() - 1 * DIA) };
const ESTADO_7_RECHEQUEO_VIEJO: HechoReps = { ...VIGENTE_AL_DIA, verificadoEn: new Date(NOW.getTime() - 400 * DIA) };
const ESTADO_8_VIGENTE_SIN_FECHA: HechoReps = { ...VIGENTE_AL_DIA, vigenteHasta: null };

describe("SPEC-813 · clasificarAvisoReps — los 8 estados, uno por uno, con su veredicto de disparo", () => {
    it("1 · sin fila (nunca se cargó) → SIN_VERIFICAR (no dispara el aviso)", () => {
        expect(clasificarAvisoReps(ESTADO_1_SIN_FILA, EXIGE, NOW)).toBe("SIN_VERIFICAR");
    });
    it("2 · resultado=SIN_VERIFICAR → SIN_VERIFICAR (no dispara)", () => {
        expect(clasificarAvisoReps(ESTADO_2_SIN_VERIFICAR, EXIGE, NOW)).toBe("SIN_VERIFICAR");
    });
    it("3 · VIGENTE con los dos relojes OK → AL_DIA (no dispara)", () => {
        expect(clasificarAvisoReps(ESTADO_3_AL_DIA, EXIGE, NOW)).toBe("AL_DIA");
    });
    it("4 · VENCIDA → CADUCADO (aviso al profesional)", () => {
        expect(clasificarAvisoReps(ESTADO_4_VENCIDA, EXIGE, NOW)).toBe("CADUCADO");
    });
    it("5 · NO_ENCONTRADA → REVISION_ADMIN (no al profesional)", () => {
        expect(clasificarAvisoReps(ESTADO_5_NO_ENCONTRADA, EXIGE, NOW)).toBe("REVISION_ADMIN");
    });
    it("6 · VIGENTE + vigenteHasta ya pasó → CADUCADO (aviso al profesional)", () => {
        expect(clasificarAvisoReps(ESTADO_6_VIGENCIA_PASADA, EXIGE, NOW)).toBe("CADUCADO");
    });
    it("7 · VIGENTE pero NUESTRO re-chequeo venció (autoridad aún vigente) → REVISION_ADMIN, NO CADUCADO", () => {
        // EL PUNTO de la spec: el 7 NO dispara el aviso al profesional.
        expect(clasificarAvisoReps(ESTADO_7_RECHEQUEO_VIEJO, EXIGE, NOW)).toBe("REVISION_ADMIN");
        expect(debeMostrarAvisoCaducadoReps(ESTADO_7_RECHEQUEO_VIEJO, EXIGE, NOW)).toBe(false);
    });
    it("8 · VIGENTE sin vigenteHasta (borde inconstruible por el CHECK) → REVISION_ADMIN", () => {
        expect(clasificarAvisoReps(ESTADO_8_VIGENTE_SIN_FECHA, EXIGE, NOW)).toBe("REVISION_ADMIN");
    });
});

describe("SPEC-813 · el disparador del aviso = estado caducado EXPLÍCITO (no ¬repsAlDia)", () => {
    it("debeMostrarAvisoCaducadoReps es true SOLO en 4 y 6", () => {
        expect(debeMostrarAvisoCaducadoReps(ESTADO_4_VENCIDA, EXIGE, NOW)).toBe(true);
        expect(debeMostrarAvisoCaducadoReps(ESTADO_6_VIGENCIA_PASADA, EXIGE, NOW)).toBe(true);
        for (const h of [ESTADO_1_SIN_FILA, ESTADO_2_SIN_VERIFICAR, ESTADO_3_AL_DIA, ESTADO_5_NO_ENCONTRADA, ESTADO_7_RECHEQUEO_VIEJO, ESTADO_8_VIGENTE_SIN_FECHA]) {
            expect(debeMostrarAvisoCaducadoReps(h, EXIGE, NOW)).toBe(false);
        }
    });
    it("requiereRevisionAdminReps es true SOLO en 5, 7 y 8 (excluir ≠ silenciar: tienen su canal)", () => {
        for (const h of [ESTADO_5_NO_ENCONTRADA, ESTADO_7_RECHEQUEO_VIEJO, ESTADO_8_VIGENTE_SIN_FECHA]) {
            expect(requiereRevisionAdminReps(h, EXIGE, NOW)).toBe(true);
        }
        for (const h of [ESTADO_1_SIN_FILA, ESTADO_2_SIN_VERIFICAR, ESTADO_3_AL_DIA, ESTADO_4_VENCIDA, ESTADO_6_VIGENCIA_PASADA]) {
            expect(requiereRevisionAdminReps(h, EXIGE, NOW)).toBe(false);
        }
    });
});

describe("SPEC-813 · discrimina por RELOJES, no por el estado/motivo (6, 7 y 8 son todos VIGENTE)", () => {
    it("6, 7 y 8 comparten estado=VIGENTE en el motor, pero la clasificación los separa", () => {
        for (const h of [ESTADO_6_VIGENCIA_PASADA, ESTADO_7_RECHEQUEO_VIEJO, ESTADO_8_VIGENTE_SIN_FECHA]) {
            expect(repsElegible(h, null, EXIGE, NOW).estado, "los tres son VIGENTE para el motor").toBe("VIGENTE");
        }
        expect(clasificarAvisoReps(ESTADO_6_VIGENCIA_PASADA, EXIGE, NOW)).toBe("CADUCADO");
        expect(clasificarAvisoReps(ESTADO_7_RECHEQUEO_VIEJO, EXIGE, NOW)).toBe("REVISION_ADMIN");
        expect(clasificarAvisoReps(ESTADO_8_VIGENTE_SIN_FECHA, EXIGE, NOW)).toBe("REVISION_ADMIN");
    });

    it("control positivo · desde el 7: acercar verificadoEn → AL_DIA; retroceder vigenteHasta → CADUCADO", () => {
        // Cae por NUESTRO reloj: re-verificar (verificadoEn reciente) lo rehabilita → prueba que no es de rebote.
        expect(clasificarAvisoReps({ ...ESTADO_7_RECHEQUEO_VIEJO, verificadoEn: new Date(NOW.getTime() - 10 * DIA) }, EXIGE, NOW)).toBe("AL_DIA");
        // Mover la vigencia de la autoridad al pasado lo vuelve CADUCADO (otra causa, otra categoría).
        expect(clasificarAvisoReps({ ...ESTADO_7_RECHEQUEO_VIEJO, vigenteHasta: new Date(NOW.getTime() - 1 * DIA) }, EXIGE, NOW)).toBe("CADUCADO");
    });

    it("control positivo · desde el 6: mover vigenteHasta al futuro → AL_DIA (cae por la vigencia, no de rebote)", () => {
        expect(clasificarAvisoReps({ ...ESTADO_6_VIGENCIA_PASADA, vigenteHasta: new Date(NOW.getTime() + 1 * DIA) }, EXIGE, NOW)).toBe("AL_DIA");
    });
});

describe("SPEC-813 · robusto al cierre del cutover (decisión 1 del CEO)", () => {
    it("1 y 2 NO son CADUCADO ni con exigir=true ni con exigir=false — «sin verificar» ≠ «caducado»", () => {
        for (const config of [EXIGE, CUTOVER]) {
            expect(clasificarAvisoReps(ESTADO_1_SIN_FILA, config, NOW)).toBe("SIN_VERIFICAR");
            expect(clasificarAvisoReps(ESTADO_2_SIN_VERIFICAR, config, NOW)).toBe("SIN_VERIFICAR");
            expect(debeMostrarAvisoCaducadoReps(ESTADO_1_SIN_FILA, config, NOW)).toBe(false);
            expect(debeMostrarAvisoCaducadoReps(ESTADO_2_SIN_VERIFICAR, config, NOW)).toBe(false);
        }
    });
});

describe("SPEC-813 · atado por conducta a repsElegible(..., modalidad=null) — no derivan en silencio", () => {
    const TODOS: Array<HechoReps | null> = [
        ESTADO_1_SIN_FILA, ESTADO_2_SIN_VERIFICAR, ESTADO_3_AL_DIA, ESTADO_4_VENCIDA,
        ESTADO_5_NO_ENCONTRADA, ESTADO_6_VIGENCIA_PASADA, ESTADO_7_RECHEQUEO_VIEJO, ESTADO_8_VIGENTE_SIN_FECHA,
    ];
    it("CADUCADO y REVISION_ADMIN ⟹ el motor NO lo ofrece (¬repsAlDia); AL_DIA ⟹ sí lo ofrece", () => {
        for (const config of [EXIGE, CUTOVER]) {
            for (const h of TODOS) {
                const clasif = clasificarAvisoReps(h, config, NOW);
                const ofrecible = repsElegible(h, null, config, NOW).elegible;
                if (clasif === "CADUCADO" || clasif === "REVISION_ADMIN") {
                    expect(ofrecible, `${clasif} debe estar fuera de la oferta`).toBe(false);
                } else if (clasif === "AL_DIA") {
                    expect(ofrecible, "AL_DIA debe ser ofrecible").toBe(true);
                }
            }
        }
    });
    it("SIN_VERIFICAR ⟹ ofrecible sii el cutover está abierto (exigir=false): ata la única categoría que depende del flag", () => {
        for (const config of [EXIGE, CUTOVER]) {
            for (const h of TODOS) {
                if (clasificarAvisoReps(h, config, NOW) === "SIN_VERIFICAR") {
                    expect(repsElegible(h, null, config, NOW).elegible).toBe(!config.exigirRepsVerificado);
                }
            }
        }
    });
});

describe("SPEC-813 · exhaustividad y fail-closed", () => {
    it("todo EstadoReps (más 'sin fila') cae en una categoría conocida — un 5º valor del enum se delataría", () => {
        const entradas: Array<HechoReps | null> = [null, ...ESTADOS_REPS.map((resultado) => ({ ...VIGENTE_AL_DIA, resultado }))];
        for (const h of entradas) {
            const clasif: ClasificacionAvisoReps = clasificarAvisoReps(h, EXIGE, NOW);
            expect(CLASIFICACIONES_AVISO_REPS).toContain(clasif);
        }
    });
    it("fail-closed · now inválido → REVISION_ADMIN (nunca CADUCADO ni AL_DIA: no afirmar caducado ante la duda)", () => {
        expect(clasificarAvisoReps(VIGENTE_AL_DIA, EXIGE, new Date(NaN))).toBe("REVISION_ADMIN");
        expect(debeMostrarAvisoCaducadoReps(VIGENTE_AL_DIA, EXIGE, new Date(NaN))).toBe(false);
    });
});
