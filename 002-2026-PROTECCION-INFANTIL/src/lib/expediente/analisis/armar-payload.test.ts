/**
 * SPEC-341 · T013 · guarda del blindaje del payload al modelo (SC-002, SC-006).
 *
 * Un modelo LLM ve exactamente lo que el orquestador arma. Estos tests le
 * ponen valla a lo que puede aparecer bajo cada `alcance` — SI CAMBIA el
 * armador y se cuela un identificador, texto o nombre por el `alcance` de
 * colegio, este test falla.
 */
import { describe, it, expect } from "vitest";
import { armarPayload, armarPayloadColegio, armarPayloadPadre } from "./armar-payload";
import type { CategoriaConducta } from "@prisma/client";

describe("armarPayload · PADRE_COMPLETO", () => {
    const hechos = [
        {
            fecha: new Date("2026-08-01T22:30:00Z"),
            ciudad: "Riohacha",
            pais: "CO",
            plataforma: "whatsapp",
            categoria: "CONTACTO_INSISTENTE" as CategoriaConducta,
            edadReportada: 12,
        },
        {
            fecha: new Date("2026-08-15T21:15:00Z"),
            ciudad: "Riohacha",
            pais: "CO",
            plataforma: "whatsapp",
            categoria: "CONTACTO_INSISTENTE" as CategoriaConducta,
            edadReportada: 12,
        },
        {
            fecha: new Date("2026-08-20T09:00:00Z"),
            ciudad: "Valledupar",
            pais: "CO",
            plataforma: "instagram",
            categoria: "SOLICITUD_MATERIAL" as CategoriaConducta,
            edadReportada: 13,
        },
    ];
    const hijoCruzado = { edad: 12, sexo: "F" };

    it("incluye la lista completa de hechos y el hijo cruzado", () => {
        const p = armarPayloadPadre({ hechos, hijoCruzado });
        expect(p.alcance).toBe("PADRE_COMPLETO");
        expect(p.numHechos).toBe(3);
        expect(p.hechos).toHaveLength(3);
        expect(p.hijoCruzado).toEqual({ edad: 12, sexo: "F" });
    });

    it("calcula categoría, franja y ciudad dominantes", () => {
        const p = armarPayloadPadre({ hechos, hijoCruzado });
        expect(p.categoriaDominante).toBe("CONTACTO_INSISTENTE");
        expect(p.franjaHorariaDominante).toBe("18-24"); // 2 hechos entre 21 y 23
        expect(p.ciudadDominante).toBe("Riohacha");
    });

    it("tolera lista vacía sin colgar", () => {
        const p = armarPayloadPadre({ hechos: [], hijoCruzado: null });
        expect(p.numHechos).toBe(0);
        expect(p.categoriaDominante).toBeNull();
        expect(p.ciudadDominante).toBeNull();
    });
});

describe("armarPayload · COLEGIO_BLINDADO (BLINDAJE PII · SC-002/SC-006)", () => {
    const agregados = [
        { curso: "9°-A", plataforma: "whatsapp", franjaHoraria: "18-24", categoria: "CONTACTO_INSISTENTE" as CategoriaConducta, cantidad: 3 },
        { curso: "9°-A", plataforma: "instagram", franjaHoraria: "12-18", categoria: "SUPLANTACION_IDENTIDAD" as CategoriaConducta, cantidad: 2 },
        { curso: "10°-B", plataforma: "tiktok", franjaHoraria: "18-24", categoria: "CIBERACOSO" as CategoriaConducta, cantidad: 4 },
    ];

    it("agrega correctamente por categoría, franja, curso y plataforma", () => {
        const p = armarPayloadColegio({ agregados });
        expect(p.alcance).toBe("COLEGIO_BLINDADO");
        expect(p.numHechos).toBe(9);
        expect(p.agregadosPorCurso.find((a) => a.curso === "9°-A")?.cantidad).toBe(5);
        expect(p.agregadosPorCategoria.find((a) => a.categoria === "CIBERACOSO")?.cantidad).toBe(4);
    });

    it("NO contiene ningún identificador, nombre, texto de reporte, edad ni sexo (SC-002)", () => {
        // Sembramos nombres/identificadores en el CONTEXTO del test — el payload NO los recibe.
        const identificadoresProhibidos = [
            "alum_1_0001", "acu_1_2", "prof_1_003",
            "María Fernanda", "Juan Carlos", "12345678",
            "textocifradodelreporte", "@usuario_real",
        ];
        const p = armarPayloadColegio({ agregados });
        const asJson = JSON.stringify(p);

        for (const prohibido of identificadoresProhibidos) {
            expect(asJson, `el payload de COLEGIO_BLINDADO NO puede contener "${prohibido}"`)
                .not.toContain(prohibido);
        }

        // Guardas positivas: el shape correcto está.
        expect(asJson).toContain("COLEGIO_BLINDADO");
        expect(asJson).toContain("agregadosPorCategoria");
        // Y NO hay campos individuales — nada de edad/sexo/hechos crudos.
        expect(asJson).not.toContain("edadReportada");
        expect(asJson).not.toContain("hijoCruzado");
        expect(asJson).not.toContain("hechos");
    });

    it("tolera lista vacía", () => {
        const p = armarPayloadColegio({ agregados: [] });
        expect(p.numHechos).toBe(0);
        expect(p.agregadosPorCategoria).toEqual([]);
    });
});

describe("armarPayload · entrada única con alcance", () => {
    it("despacha por alcance sin ramas escondidas", () => {
        const p1 = armarPayload({ alcance: "PADRE_COMPLETO", hechos: [], hijoCruzado: null });
        const p2 = armarPayload({ alcance: "COLEGIO_BLINDADO", agregados: [] });
        expect(p1.alcance).toBe("PADRE_COMPLETO");
        expect(p2.alcance).toBe("COLEGIO_BLINDADO");
    });
});
