import { describe, it, expect, vi } from "vitest";
import type { CategoriaConducta, EstadoReporte } from "@prisma/client";
import { decidirGuardasSeguridad } from "./guardas-decision";
import { detectarDoxing } from "./pii-patterns";
import { detectarKeywordsRiesgo } from "./keywords-riesgo";
import { aplicarGuardasSeguridad } from "@/lib/dal/services/reporte-processing/guardas";

// registrarPaso escribe en la trazabilidad de expediente (DB); en este test de
// paridad solo importan las decisiones, no el side-effect.
vi.mock("@/lib/expediente/pasos", () => ({ registrarPaso: vi.fn() }));

const TEXTO_NEUTRO = "un compañero me escribio por chat para tarea";
const TEXTO_DOXING = "Voy a publicar la dirección: cra 7 # 45-67, colegio San José";
const TEXTO_KEYWORDS = "me hicieron sextorsión con fotos";

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

describe("paridad guardas: módulo compartido vs helper de producción", () => {
    for (const umbralSpam of UMBRALES_SPAM) {
        for (const caso of CASOS) {
            it(`[umbral=${umbralSpam}] ${caso.nombre}`, () => {
                const produccion = aplicarGuardasSeguridad({
                    reporteId: "test-paridad",
                    texto: caso.texto,
                    clasificacion: {
                        categoria: caso.categoria,
                        confianza: caso.confianza,
                        categoriasSecundarias: [],
                        posibleAgresorPar: false,
                        estado: caso.estadoInicial,
                        metrics: { modelo: "test", latenciaMs: 0 },
                        rawResponse: null,
                        votos: [],
                    },
                    estadoInicial: caso.estadoInicial,
                    esRafaga: caso.esRafaga,
                    umbralSpam,
                });

                const compartida = decidirGuardasSeguridad({
                    texto: caso.texto,
                    clasificacion: { categoria: caso.categoria, confianza: caso.confianza },
                    estadoInicial: caso.estadoInicial,
                    esRafaga: caso.esRafaga,
                    umbralSpam,
                });

                expect(compartida.estadoFinal).toBe(produccion.estadoFinal);
                expect(compartida.prioridadAlta).toBe(produccion.prioridadAlta);
                expect(compartida.keywordsDetectadas).toEqual(produccion.keywordsDetectadas);
            });
        }
    }
});

// Copia literal de la lógica que sandbox.ts y eval-runner.ts tenían ANTES de la
// unificación (spec 123), para demostrar el antes/después.
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
                estadoInicial: caso.estadoInicial,
                esRafaga: false,
                umbralSpam: 0.7,
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
            estadoInicial: "CLASIFICADO",
            esRafaga: false,
            umbralSpam: 0.7,
        });
        // Antes: SPAM quedaba CLASIFICADO en sandbox/eval; ahora decide como
        // producción (POSIBLE_SPAM). Es la adopción mandatada, no una desviación.
        expect(antes.estadoFinal).toBe("CLASIFICADO");
        expect(despues.estadoFinal).toBe("POSIBLE_SPAM");

        // Con confianza baja no cambia nada (igual que producción).
        const baja = decidirGuardasSeguridad({
            texto: TEXTO_NEUTRO,
            clasificacion: { categoria: "SPAM", confianza: 0.5 },
            estadoInicial: "CLASIFICADO",
            esRafaga: false,
            umbralSpam: 0.7,
        });
        expect(baja.estadoFinal).toBe("CLASIFICADO");
    });
});
