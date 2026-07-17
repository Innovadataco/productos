import { describe, it, expect } from "vitest";
import { detectarKeywordsRiesgo } from "./keywords-riesgo";

describe("detectarKeywordsRiesgo", () => {
    it("detecta sextorsión sin importar tildes", () => {
        const res = detectarKeywordsRiesgo("me hicieron sextorsión con fotos");
        expect(res.tieneMatch).toBe(true);
        expect(res.keywords).toContain("sextorsion");
        expect(res.categoriaSugerida).toBe("EXTORSION");
    });

    it("detecta deepfake/nudificación", () => {
        const res = detectarKeywordsRiesgo("subieron un deepfake desnudo mio");
        expect(res.tieneMatch).toBe(true);
        expect(res.keywords).toContain("deepfake");
    });

    it("detecta MASNNA", () => {
        const res = detectarKeywordsRiesgo("me pasaron material de abuso sexual menor");
        expect(res.tieneMatch).toBe(true);
        expect(res.keywords).toContain("material de abuso sexual menor");
    });

    it("detecta grooming en juegos con propuesta de encuentro", () => {
        const res = detectarKeywordsRiesgo("conoci a alguien en roblox y quiere que nos veamos");
        expect(res.tieneMatch).toBe(true);
        expect(res.keywords).toContain("roblox + encuentro");
    });

    it("detecta secretismo/aislamiento", () => {
        const res = detectarKeywordsRiesgo("dijo que no le diga a nadie y borre los mensajes");
        expect(res.tieneMatch).toBe(true);
        expect(res.keywords).toContain("no le digas a nadie");
        expect(res.keywords).toContain("borra los mensajes");
    });

    it("detecta DOXING no capturado por la guarda actual", () => {
        const res = detectarKeywordsRiesgo("voy a publicar su direccion en internet");
        expect(res.tieneMatch).toBe(true);
        expect(res.keywords).toContain("publicar su direccion");
        expect(res.categoriaSugerida).toBe("DOXING");
    });

    it("detecta frontera difusión no consentida", () => {
        const res = detectarKeywordsRiesgo("se filtraron fotos mias por el chat");
        expect(res.tieneMatch).toBe(true);
        expect(res.keywords).toContain("se filtraron fotos");
    });

    it("detecta contacto insistente", () => {
        const res = detectarKeywordsRiesgo("no deja de escribirme y me molesta todo el tiempo");
        expect(res.tieneMatch).toBe(true);
        expect(res.keywords).toContain("no deja de escribirme");
    });

    it("no dispara con texto inocuo", () => {
        const res = detectarKeywordsRiesgo("hola como estas todo bien en el colegio");
        expect(res.tieneMatch).toBe(false);
        expect(res.keywords).toHaveLength(0);
    });

    it("no dispara con palabra aislada 'fotos'", () => {
        const res = detectarKeywordsRiesgo("me mandaron fotos del paseo");
        expect(res.tieneMatch).toBe(false);
    });
});
