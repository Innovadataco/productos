/**
 * CANDADO · SPEC-685 (PR2) · La ficha usa LISTAS CERRADAS, no texto libre.
 *
 * Dos conductas que no se pueden fingir:
 *  1. La completitud para EN_REVISION se mide sobre profesión + áreas + rango
 *     (las listas cerradas), NO sobre el título/especialidades libres viejos.
 *     Control por remoción: un perfil que SOLO tiene los campos viejos no está
 *     completo (si alguien revierte `perfilCompletoParaRevision` a los campos
 *     viejos, este caso se pone en rojo).
 *  2. La pantalla de la ficha pinta el catálogo (select de profesión + casillas
 *     de áreas/rango cableadas al fetch de /api/profesional/catalogos) y ya NO
 *     el texto libre; la etiqueta de nombre es la FORMA de Diseño («Nombre
 *     público»), no la pregunta vieja «Cómo desea que lo vean».
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { PerfilProfesional } from "@prisma/client";
import { perfilCompletoParaRevision } from "./dto";

/** Perfil mínimo y COMPLETO (listas cerradas llenas); cada test rompe una pieza. */
function perfilCompleto(over: Partial<PerfilProfesional> = {}): PerfilProfesional {
    return {
        nombreVisible: "Dra. Ramírez",
        profesion: "psicologo",
        areasAtencion: ["ansiedad"],
        rangoEtario: ["6-11"],
        ciudadId: "ciudad-x",
        atiendeVirtual: true,
        atiendePresencial: false,
        aniosExperiencia: 5,
        presentacion: "Acompaño a familias con niñez y adolescencia.",
        tarifaConsultaCOP: 120_000,
        duracionMinutos: 50,
        autorizacionArchivoId: "arch-1",
        // Campos viejos presentes: NO deben bastar para completar.
        tituloProfesional: "",
        especialidades: [],
        ...over,
    } as PerfilProfesional;
}

// SPEC-703: la completitud exige la aceptación de la autorización. Este candado prueba los
// CAMPOS de la ficha, así que se pasa `aceptó = true` para aislarlos (la regla de la aceptación
// la cubren dto.test.ts y el candado de recorrido de SPEC-703).
describe("SPEC-685 · completitud sobre listas cerradas", () => {
    it("perfil con profesión + área + rango (y lo demás) → COMPLETO", () => {
        expect(perfilCompletoParaRevision(perfilCompleto(), true)).toBe(true);
    });

    it("sin profesión → NO completo", () => {
        expect(perfilCompletoParaRevision(perfilCompleto({ profesion: null }), true)).toBe(false);
        expect(perfilCompletoParaRevision(perfilCompleto({ profesion: "" }), true)).toBe(false);
    });

    it("sin ningún área → NO completo", () => {
        expect(perfilCompletoParaRevision(perfilCompleto({ areasAtencion: [] }), true)).toBe(false);
    });

    it("sin ningún rango de edad → NO completo", () => {
        expect(perfilCompletoParaRevision(perfilCompleto({ rangoEtario: [] }), true)).toBe(false);
    });

    it("control por remoción: SOLO los campos viejos (título/especialidades) NO bastan", () => {
        const soloViejos = perfilCompleto({
            profesion: null,
            areasAtencion: [],
            rangoEtario: [],
            tituloProfesional: "Psicólogo clínico",
            especialidades: ["Terapia familiar"],
        });
        expect(perfilCompletoParaRevision(soloViejos, true)).toBe(false);
    });
});

describe("SPEC-685 · la ficha pinta el catálogo y no texto libre", () => {
    const src = fs.readFileSync(
        path.resolve(process.cwd(), "src/app/perfil-profesional/completar/page.tsx"),
        "utf-8",
    );

    it("consume el catálogo del servidor y lo cablea a los tres campos", () => {
        expect(src).toContain("/api/profesional/catalogos");
        expect(/setProfesion\(/.test(src)).toBe(true);
        expect(/toggleEnLista\(setAreasAtencion/.test(src)).toBe(true);
        expect(/toggleEnLista\(setRangoEtario/.test(src)).toBe(true);
    });

    it("la etiqueta de nombre es la FORMA de Diseño, no la pregunta vieja", () => {
        expect(src).toContain("Nombre público");
        expect(src).toContain("Así lo verán las familias en el directorio");
        expect(src).not.toContain("Cómo desea que lo vean");
    });

    it("desaparece el texto libre de título y especialidades", () => {
        expect(src).not.toContain("Título profesional");
        expect(src).not.toContain("Especialidades (separadas por coma)");
        expect(src).not.toContain("especialidadesTexto");
        expect(src).not.toContain("setTituloProfesional");
    });
});
