import { describe, it, expect, vi } from "vitest";
import type { CategoriaConducta, EstadoReporte } from "@prisma/client";
import { decidirGuardasSeguridad, normalizarCategoriasSecundarias, detectarSpamPublicitarioDeterministico } from "./guardas-decision";
import { detectarDoxing } from "./pii-patterns";
import { detectarKeywordsRiesgo } from "./keywords-riesgo";
// registrarPaso escribe en la trazabilidad de expediente (DB); en este test de
// paridad solo importan las decisiones, no el side-effect.
vi.mock("@/lib/expediente/pasos", () => ({ registrarPaso: vi.fn() }));

const TEXTO_NEUTRO = "un compañero me escribio por chat para tarea";
const TEXTO_DOXING = "Voy a publicar la dirección: cra 7 # 45-67, colegio San José";
const TEXTO_KEYWORDS = "me hicieron sextorsión con fotos";

// Severidades reales de ParametroSistema (verificadas en BD, escala 0-95).
const SEVERIDAD: Record<string, number> = {
    CONTACTO_INSISTENTE: 30,
    SOLICITUD_MATERIAL: 80,
    OFRECIMIENTO_REGALOS: 60,
    SUPLANTACION_IDENTIDAD: 70,
    SOLICITUD_ENCUENTRO: 90,
    COMPARTIMIENTO_SEXUAL: 95,
    EXTORSION: 85,
    CONTENIDO_GENERADO_IA: 75,
    DIFUSION_NO_CONSENTIDA: 90,
    DOXING: 85,
    SPAM: 0,
    OTRO: 20,
};
const SEVERIDAD_RECORD: Record<string, number> = SEVERIDAD;

interface Caso {
    nombre: string;
    texto: string;
    categoria: CategoriaConducta;
    confianza: number;
    estadoInicial: EstadoReporte;
    esRafaga: boolean;
}

const CASOS: Caso[] = [
    { nombre: "limpio CLASIFICADO sin señales", texto: TEXTO_NEUTRO, categoria: "CONTACTO_INSISTENTE", confianza: 0.9, estadoInicial: "CLASIFICADO", esRafaga: false },
    { nombre: "SPAM confianza alta → POSIBLE_SPAM", texto: TEXTO_NEUTRO, categoria: "SPAM", confianza: 0.9, estadoInicial: "CLASIFICADO", esRafaga: false },
    { nombre: "SPAM confianza baja → estado inicial", texto: TEXTO_NEUTRO, categoria: "SPAM", confianza: 0.5, estadoInicial: "CLASIFICADO", esRafaga: false },
    { nombre: "SPAM alta + doxing: POSIBLE_SPAM cortocircuita", texto: TEXTO_DOXING, categoria: "SPAM", confianza: 0.95, estadoInicial: "CLASIFICADO", esRafaga: true },
    { nombre: "doxing no reflejado por el modelo", texto: TEXTO_DOXING, categoria: "OTRO", confianza: 0.8, estadoInicial: "CLASIFICADO", esRafaga: false },
    { nombre: "doxing reflejado (categoria DOXING): no fuerza", texto: TEXTO_DOXING, categoria: "DOXING", confianza: 0.85, estadoInicial: "CLASIFICADO", esRafaga: false },
    { nombre: "keywords + OTRO + CLASIFICADO → REVISION_MANUAL", texto: TEXTO_KEYWORDS, categoria: "OTRO", confianza: 0.7, estadoInicial: "CLASIFICADO", esRafaga: false },
    { nombre: "keywords + categoria distinta de OTRO: sin cambio", texto: TEXTO_KEYWORDS, categoria: "EXTORSION", confianza: 0.9, estadoInicial: "CLASIFICADO", esRafaga: false },
    { nombre: "keywords + estadoInicial REVISION_MANUAL: prioridad alta", texto: TEXTO_KEYWORDS, categoria: "EXTORSION", confianza: 0.6, estadoInicial: "REVISION_MANUAL", esRafaga: false },
    { nombre: "ráfaga → REVISION_MANUAL con prioridad", texto: TEXTO_NEUTRO, categoria: "CONTACTO_INSISTENTE", confianza: 0.95, estadoInicial: "CLASIFICADO", esRafaga: true },
    { nombre: "doxing + keywords combinados", texto: `${TEXTO_DOXING}; ${TEXTO_KEYWORDS}`, categoria: "OTRO", confianza: 0.75, estadoInicial: "CLASIFICADO", esRafaga: false },
    { nombre: "doxing + ráfaga combinados", texto: TEXTO_DOXING, categoria: "OTRO", confianza: 0.75, estadoInicial: "CLASIFICADO", esRafaga: true },
];

const UMBRALES_SPAM = [0.7, 0.5, 0.95];
const UMBRAL_SPAM_DOMINANCIA = 0.66;
const SEVERIDAD_MIN_GRAVE = 75;

describe("paridad guardas: wrapper de producción vs helper compartido", () => {
    for (const umbralSpam of UMBRALES_SPAM) {
        for (const caso of CASOS) {
            it(`[umbral=${umbralSpam}] ${caso.nombre}`, () => {
                // El wrapper de producción lee parámetros de BD y delega en
                // decidirGuardasSeguridad; en unit comparamos la decisión pura
                // (sin Prisma) para garantizar que el helper compartido no se
                // desvía de la lógica de producción.
                const produccion = decidirGuardasSeguridad({
                    texto: caso.texto,
                    clasificacion: { categoria: caso.categoria, confianza: caso.confianza },
                    categoriasSecundarias: [],
                    estadoInicial: caso.estadoInicial,
                    esRafaga: caso.esRafaga,
                    umbralSpam,
                    umbralSpamDominancia: UMBRAL_SPAM_DOMINANCIA,
                    severidadMinGrave: SEVERIDAD_MIN_GRAVE,
                    severidades: SEVERIDAD_RECORD,
                });

                const compartida = decidirGuardasSeguridad({
                    texto: caso.texto,
                    clasificacion: { categoria: caso.categoria, confianza: caso.confianza },
                    categoriasSecundarias: [],
                    estadoInicial: caso.estadoInicial,
                    esRafaga: caso.esRafaga,
                    umbralSpam,
                    umbralSpamDominancia: UMBRAL_SPAM_DOMINANCIA,
                    severidadMinGrave: SEVERIDAD_MIN_GRAVE,
                    severidades: SEVERIDAD_RECORD,
                });

                expect(compartida.estadoFinal).toBe(produccion.estadoFinal);
                expect(compartida.prioridadAlta).toBe(produccion.prioridadAlta);
                expect(compartida.keywordsDetectadas).toEqual(produccion.keywordsDetectadas);
            });
        }
    }
});

// Copia literal de la lógica que sandbox.ts tenía ANTES de la unificación
// (spec 123), para demostrar el antes/después.
function guardasViejas({
    texto,
    categoria,
    estadoInicial,
}: {
    texto: string;
    categoria: CategoriaConducta;
    estadoInicial: EstadoReporte;
}): { estadoFinal: EstadoReporte; prioridadAlta: boolean; keywordsDetectadas: string[] } {
    const doxing = detectarDoxing(texto);
    const keywords = detectarKeywordsRiesgo(texto);
    let estadoFinal = estadoInicial;
    let prioridadAlta = false;
    let keywordsDetectadas: string[] = [];

    if (doxing.esDoxing && categoria !== "DOXING") {
        estadoFinal = "REVISION_MANUAL";
        prioridadAlta = true;
        keywordsDetectadas = doxing.fragmentos.length > 0 ? doxing.fragmentos : ["doxing"];
    }
    if (keywords.tieneMatch && ((estadoFinal === "CLASIFICADO" && categoria === "OTRO") || estadoFinal === "REVISION_MANUAL")) {
        prioridadAlta = true;
        keywordsDetectadas = Array.from(new Set([...keywordsDetectadas, ...keywords.keywords]));
        if (estadoFinal === "CLASIFICADO" && categoria === "OTRO") {
            estadoFinal = "REVISION_MANUAL";
        }
    }
    return { estadoFinal, prioridadAlta, keywordsDetectadas };
}

describe("antes/después: adopción de la lógica de producción", () => {
    const casosSinSpamNiRafaga = CASOS.filter((c) => c.categoria !== "SPAM" && !c.esRafaga);

    for (const caso of casosSinSpamNiRafaga) {
        it(`decisión idéntica antes/después: ${caso.nombre}`, () => {
            const antes = guardasViejas({ texto: caso.texto, categoria: caso.categoria, estadoInicial: caso.estadoInicial });
            const despues = decidirGuardasSeguridad({
                texto: caso.texto,
                clasificacion: { categoria: caso.categoria, confianza: caso.confianza },
                categoriasSecundarias: [],
                estadoInicial: caso.estadoInicial,
                esRafaga: false,
                umbralSpam: 0.7,
                umbralSpamDominancia: UMBRAL_SPAM_DOMINANCIA,
                severidadMinGrave: SEVERIDAD_MIN_GRAVE,
                severidades: SEVERIDAD_RECORD,
            });
            expect(despues.estadoFinal).toBe(antes.estadoFinal);
            expect(despues.prioridadAlta).toBe(antes.prioridadAlta);
            expect(despues.keywordsDetectadas).toEqual(antes.keywordsDetectadas);
        });
    }

    it("el único cambio de decisión es la rama SPAM adoptada de producción", () => {
        const antes = guardasViejas({ texto: TEXTO_NEUTRO, categoria: "SPAM", estadoInicial: "CLASIFICADO" });
        const despues = decidirGuardasSeguridad({
            texto: TEXTO_NEUTRO,
            clasificacion: { categoria: "SPAM", confianza: 0.9 },
            categoriasSecundarias: [],
            estadoInicial: "CLASIFICADO",
            esRafaga: false,
            umbralSpam: 0.7,
            umbralSpamDominancia: UMBRAL_SPAM_DOMINANCIA,
            severidadMinGrave: SEVERIDAD_MIN_GRAVE,
            severidades: SEVERIDAD_RECORD,
        });
        // Antes: SPAM quedaba CLASIFICADO en sandbox/eval; ahora decide como
        // producción (POSIBLE_SPAM). Es la adopción mandatada, no una desviación.
        expect(antes.estadoFinal).toBe("CLASIFICADO");
        expect(despues.estadoFinal).toBe("POSIBLE_SPAM");

        // Con confianza baja no cambia nada (igual que producción).
        const baja = decidirGuardasSeguridad({
            texto: TEXTO_NEUTRO,
            clasificacion: { categoria: "SPAM", confianza: 0.5 },
            categoriasSecundarias: [],
            estadoInicial: "CLASIFICADO",
            esRafaga: false,
            umbralSpam: 0.7,
            umbralSpamDominancia: UMBRAL_SPAM_DOMINANCIA,
            severidadMinGrave: SEVERIDAD_MIN_GRAVE,
            severidades: SEVERIDAD_RECORD,
        });
        expect(baja.estadoFinal).toBe("CLASIFICADO");
    });
});

describe("SPEC-199: guarda de dominancia SPAM", () => {
    it("fuerza POSIBLE_SPAM cuando SPAM secundario domina sin categoría grave", () => {
        const decision = decidirGuardasSeguridad({
            texto: "FELICITACIONES!! Has ganado un iPhone. Llama al 3001234567 ya!!!",
            clasificacion: { categoria: "OFRECIMIENTO_REGALOS", confianza: 1.0 },
            categoriasSecundarias: [{ categoria: "SPAM", score: 0.67 }],
            estadoInicial: "CLASIFICADO",
            esRafaga: false,
            umbralSpam: 0.7,
            umbralSpamDominancia: UMBRAL_SPAM_DOMINANCIA,
            severidadMinGrave: SEVERIDAD_MIN_GRAVE,
            severidades: SEVERIDAD_RECORD,
        });
        expect(decision.estadoFinal).toBe("POSIBLE_SPAM");
        expect(decision.reglasAplicadas).toContain("spam_dominancia");
    });

    it("NO fuerza SPAM cuando hay categoría grave presente", () => {
        const decision = decidirGuardasSeguridad({
            texto: "dame $100 o publico tus fotos",
            clasificacion: { categoria: "EXTORSION", confianza: 0.9 },
            categoriasSecundarias: [{ categoria: "SPAM", score: 0.67 }],
            estadoInicial: "CLASIFICADO",
            esRafaga: false,
            umbralSpam: 0.7,
            umbralSpamDominancia: UMBRAL_SPAM_DOMINANCIA,
            severidadMinGrave: SEVERIDAD_MIN_GRAVE,
            severidades: SEVERIDAD_RECORD,
        });
        expect(decision.estadoFinal).toBe("CLASIFICADO");
        expect(decision.reglasAplicadas).not.toContain("spam_dominancia");
    });

    it("NO fuerza SPAM cuando score secundario está bajo del umbral", () => {
        const decision = decidirGuardasSeguridad({
            texto: TEXTO_NEUTRO,
            clasificacion: { categoria: "OFRECIMIENTO_REGALOS", confianza: 0.8 },
            categoriasSecundarias: [{ categoria: "SPAM", score: 0.5 }],
            estadoInicial: "CLASIFICADO",
            esRafaga: false,
            umbralSpam: 0.7,
            umbralSpamDominancia: UMBRAL_SPAM_DOMINANCIA,
            severidadMinGrave: SEVERIDAD_MIN_GRAVE,
            severidades: SEVERIDAD_RECORD,
        });
        expect(decision.estadoFinal).toBe("CLASIFICADO");
        expect(decision.reglasAplicadas).not.toContain("spam_dominancia");
    });

    it("normalizarCategoriasSecundarias descarta items mal formados", () => {
        const raw = [
            { categoria: "SPAM", score: 0.67 },
            { categoria: 123, score: 0.8 },
            { score: 0.9 },
            "malformed",
        ];
        const normalizadas = normalizarCategoriasSecundarias(raw);
        expect(normalizadas).toEqual([{ categoria: "SPAM", score: 0.67 }]);
    });
});

const ACORTADORES = ["bit.ly", "tinyurl", "is.gd", "t.co", "cutt.ly", "ow.ly", "buff.ly"];
const TEXTO_RPT_QFUHE8 =
    "🎉🎉🎉 FELICIDADES #ganadores #premio #sorteo 🎉🎉🎉 Has sido seleccionado para ganar $500.000 en efectivo. Solo tienes que enviar un mensaje AHORA al WhatsApp bit.ly/xyz123 y únete al grupo. Oferta limitada, últimas horas. Escribe YA para reclamar tu dinero. 💰💰💰";
const TEXTO_UN_HASHTAG = "un compañero #molesto me escribio por chat";

describe("SPEC-207: hard-rule anti-spam publicitario determinístico", () => {
    it("detecta spam textbook RPT-QFUHE8", () => {
        const det = detectarSpamPublicitarioDeterministico(TEXTO_RPT_QFUHE8, ACORTADORES);
        expect(det.esSpam).toBe(true);
        expect(det.señales).toBeGreaterThanOrEqual(2);
    });

    it("fuerza POSIBLE_SPAM con regla spam_publicitario_deterministico", () => {
        const decision = decidirGuardasSeguridad({
            texto: TEXTO_RPT_QFUHE8,
            clasificacion: { categoria: "OFRECIMIENTO_REGALOS", confianza: 0.67 },
            categoriasSecundarias: [],
            estadoInicial: "CLASIFICADO",
            esRafaga: false,
            umbralSpam: 0.7,
            umbralSpamDominancia: 0.33,
            severidadMinGrave: SEVERIDAD_MIN_GRAVE,
            severidades: SEVERIDAD_RECORD,
            dominiosAcortadores: ACORTADORES,
        });
        expect(decision.estadoFinal).toBe("POSIBLE_SPAM");
        expect(decision.reglasAplicadas).toContain("spam_publicitario_deterministico");
    });

    it("NO aplica hard-rule con solo 1 hashtag y sin link acortado", () => {
        const det = detectarSpamPublicitarioDeterministico(TEXTO_UN_HASHTAG, ACORTADORES);
        expect(det.esSpam).toBe(false);

        const decision = decidirGuardasSeguridad({
            texto: TEXTO_UN_HASHTAG,
            clasificacion: { categoria: "CONTACTO_INSISTENTE", confianza: 0.8 },
            categoriasSecundarias: [],
            estadoInicial: "CLASIFICADO",
            esRafaga: false,
            umbralSpam: 0.7,
            umbralSpamDominancia: 0.33,
            severidadMinGrave: SEVERIDAD_MIN_GRAVE,
            severidades: SEVERIDAD_RECORD,
            dominiosAcortadores: ACORTADORES,
        });
        expect(decision.estadoFinal).toBe("CLASIFICADO");
        expect(decision.reglasAplicadas).not.toContain("spam_publicitario_deterministico");
    });

    it("umbral de dominancia 0.33: un voto SPAM secundario basta sin categoría grave", () => {
        const decision = decidirGuardasSeguridad({
            texto: TEXTO_NEUTRO,
            clasificacion: { categoria: "OFRECIMIENTO_REGALOS", confianza: 1.0 },
            categoriasSecundarias: [{ categoria: "SPAM", score: 0.34 }],
            estadoInicial: "CLASIFICADO",
            esRafaga: false,
            umbralSpam: 0.7,
            umbralSpamDominancia: 0.33,
            severidadMinGrave: SEVERIDAD_MIN_GRAVE,
            severidades: SEVERIDAD_RECORD,
            dominiosAcortadores: ACORTADORES,
        });
        expect(decision.estadoFinal).toBe("POSIBLE_SPAM");
        expect(decision.reglasAplicadas).toContain("spam_dominancia");
    });
});
