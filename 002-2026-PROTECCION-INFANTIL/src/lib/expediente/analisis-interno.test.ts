import { describe, it, expect } from "vitest";
import { construirAnalisisInterno, type AnalisisInternoInput } from "./analisis-interno";

const INPUT_BASE: AnalisisInternoInput = {
    estado: "CLASIFICADO",
    esRafaga: false,
    prioridadAlta: false,
    processingError: null,
    clasificacion: { categoria: "SOLICITUD_MATERIAL", confianza: 0.67, categorias: ["SOLICITUD_MATERIAL"] },
    votos: [
        { modelo: "gemma2:27b", categoria: "SOLICITUD_MATERIAL", cumple: true,
            preguntasCumplidas: ["¿Alguien pide fotos, videos o material visual a otra persona?"] },
        { modelo: "qwen2.5:14b", categoria: "SOLICITUD_MATERIAL", cumple: true, preguntasCumplidas: [] },
        { modelo: "aya-expanse:32b", categoria: "SOLICITUD_MATERIAL", cumple: false, preguntasCumplidas: [] },
    ],
    preguntas: {
        SOLICITUD_MATERIAL: [
            { texto: "¿Alguien pide fotos, videos o material visual a otra persona?", activo: true, tipo: "decisiva" },
            { texto: "¿La persona a quien se le pide es menor de edad?", activo: true, tipo: "contexto" },
        ],
    },
    severidades: { SOLICITUD_MATERIAL: 90 },
    pesoFuente: 0.8,
};

describe("analisis-interno (T022) — síntesis factual determinista", () => {
    it("incluye consenso X/N y gravedad interna por conducta", () => {
        const texto = construirAnalisisInterno(INPUT_BASE);
        expect(texto).toContain("Consenso 2/3 en SOLICITUD_MATERIAL (gravedad interna: alta)");
    });

    it("gravedad interna: umbrales alta/media/baja sobre la severidad", () => {
        const alta = construirAnalisisInterno(INPUT_BASE);
        expect(alta).toContain("gravedad interna: alta");
        const media = construirAnalisisInterno({ ...INPUT_BASE, severidades: { SOLICITUD_MATERIAL: 50 } });
        expect(media).toContain("gravedad interna: media");
        const baja = construirAnalisisInterno({ ...INPUT_BASE, severidades: { SOLICITUD_MATERIAL: 10 } });
        expect(baja).toContain("gravedad interna: baja");
    });

    it("lista las señales decisivas cumplidas de la rúbrica (no las de contexto)", () => {
        const texto = construirAnalisisInterno(INPUT_BASE);
        expect(texto).toContain("Señales: SOLICITUD_MATERIAL: «¿Alguien pide fotos, videos o material visual a otra persona?»");
        expect(texto).not.toContain("menor de edad?");
    });

    it("disparador: ráfaga cuando el estado es REVISION_MANUAL con esRafaga", () => {
        const texto = construirAnalisisInterno({ ...INPUT_BASE, estado: "REVISION_MANUAL", esRafaga: true });
        expect(texto).toContain("Disparador: ráfaga de reportes contra el mismo identificador.");
    });

    it("disparador: desacuerdo entre modelos en revisión manual sin ráfaga", () => {
        const texto = construirAnalisisInterno({ ...INPUT_BASE, estado: "REVISION_MANUAL" });
        expect(texto).toContain("Disparador: desacuerdo entre modelos o confianza insuficiente.");
    });

    it("incluye confianza y peso de fuente", () => {
        const texto = construirAnalisisInterno(INPUT_BASE);
        expect(texto).toContain("Confianza 0.67 · peso de fuente 0.8.");
    });

    it("conclusión neutral: no afirma responsabilidad de nadie", () => {
        const texto = construirAnalisisInterno(INPUT_BASE);
        expect(texto).toContain("no determina la responsabilidad de ninguna persona");
    });

    it("sin conductas detectadas: lo dice explícitamente", () => {
        const texto = construirAnalisisInterno({ ...INPUT_BASE, clasificacion: null });
        expect(texto).toContain("Sin conductas detectadas por el modelo.");
        expect(texto).toContain("Confianza n/d");
    });

    it("sin votos de rúbrica (motor legacy): consenso lo indica", () => {
        const texto = construirAnalisisInterno({ ...INPUT_BASE, votos: [] });
        expect(texto).toContain("Sin votos de rúbrica en SOLICITUD_MATERIAL");
    });
});
