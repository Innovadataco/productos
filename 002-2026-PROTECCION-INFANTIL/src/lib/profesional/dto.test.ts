/**
 * SPEC-391 · candado de reserva: internos NO salen por el DTO público.
 * Ley 2375/2024 y aviso CEO 08:40: numeroTarjetaProfesional, datosFacturacion,
 * autorizacionArchivoId y autorizacionSubidaEn son reservados. Este test
 * rompe si alguien los cuela en el DTO — que es el único camino de salida
 * hacia el directorio abierto.
 */
import { describe, it, expect } from "vitest";
import {
    toPerfilProfesionalPublico,
    toPerfilProfesionalPropio,
    perfilCompletoParaRevision,
    CAMPOS_INTERNOS_PROFESIONAL,
} from "./dto";

const PERFIL_COMPLETO = {
    id: "cuid-1",
    usuarioId: "user-1",
    nombreVisible: "Dra. Ana Pérez",
    fotoUrl: "https://cdn/x.png",
    tituloProfesional: "Psicóloga clínica",
    especialidades: ["Ansiedad", "Familia"],
    // SPEC-685 (PR2): listas cerradas (claves). La completitud se mide sobre éstas.
    profesion: "psicologo",
    areasAtencion: ["ansiedad", "duelo"],
    rangoEtario: ["6-11"],
    ciudadId: "ciudad-1",
    atiendeVirtual: true,
    atiendePresencial: false,
    aniosExperiencia: 8,
    presentacion: "Trabajo con adolescentes y sus familias.",
    tarifaConsultaCOP: 120000,
    duracionMinutos: 50,
    emiteFactura: true,
    estado: "ACTIVO",
    numeroTarjetaProfesional: "TP-123",
    datosFacturacion: { nit: "900000001" },
    autorizacionArchivoId: "uuid-secreto",
    autorizacionSubidaEn: new Date("2026-09-03T10:00:00Z"),
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    ciudad: { id: "ciudad-1", nombre: "Bogotá" },
} as const;

describe("toPerfilProfesionalPublico · candado de reserva", () => {
    it("NUNCA incluye numeroTarjetaProfesional, datosFacturacion, autorizacionArchivoId ni autorizacionSubidaEn", () => {
        const publico = toPerfilProfesionalPublico(PERFIL_COMPLETO as never);
        for (const clave of CAMPOS_INTERNOS_PROFESIONAL) {
            expect(publico as unknown as Record<string, unknown>, `campo interno "${clave}" se coló al DTO público`).not.toHaveProperty(clave);
        }
    });

    it("H-2 (SPEC-685 PR2): profesión/áreas/rango NO llegan al padre por el DTO público", () => {
        // Si algún día deben llegar al directorio, se agregan a la allowlist A PROPÓSITO
        // (con este candado actualizado). Hoy NO llegan: este candado lo prueba.
        const publico = toPerfilProfesionalPublico(PERFIL_COMPLETO as never) as unknown as Record<string, unknown>;
        expect(publico).not.toHaveProperty("profesion");
        expect(publico).not.toHaveProperty("areasAtencion");
        expect(publico).not.toHaveProperty("rangoEtario");
    });

    it("SPEC-685 (PR2-bis): la tarifa se devuelve null cuando está «por fijar» (nunca 0)", () => {
        const publico = toPerfilProfesionalPublico({ ...PERFIL_COMPLETO, tarifaConsultaCOP: null } as never);
        expect(publico.tarifaConsultaCOP).toBeNull();
        // La clave sigue en el DTO (forma estable); el consumidor decide no pintarla.
        expect(Object.keys(publico)).toContain("tarifaConsultaCOP");
    });

    it("expone SOLO los 14 campos aprobados (allowlist explícita)", () => {
        const publico = toPerfilProfesionalPublico(PERFIL_COMPLETO as never);
        expect(Object.keys(publico).sort()).toEqual(
            [
                "aniosExperiencia",
                "atiendePresencial",
                "atiendeVirtual",
                "ciudad",
                "duracionMinutos",
                "emiteFactura",
                "especialidades",
                "estado",
                "fotoUrl",
                "id",
                "nombreVisible",
                "presentacion",
                "tarifaConsultaCOP",
                "tituloProfesional",
            ].sort()
        );
    });
});

describe("toPerfilProfesionalPropio", () => {
    it("expone `autorizacionSubida: boolean` pero NO la ruta ni la fecha", () => {
        const propio = toPerfilProfesionalPropio(PERFIL_COMPLETO as never);
        expect(propio.autorizacionSubida).toBe(true);
        // Ni el archivoUrl ni la fecha se serializan aunque el profesional sea el dueño.
        for (const clave of CAMPOS_INTERNOS_PROFESIONAL) {
            expect(propio as unknown as Record<string, unknown>, `campo interno "${clave}" se coló al DTO propio`).not.toHaveProperty(clave);
        }
    });

    it("con autorización sin subir, `autorizacionSubida` es false", () => {
        const propio = toPerfilProfesionalPropio({ ...PERFIL_COMPLETO, autorizacionArchivoId: null } as never);
        expect(propio.autorizacionSubida).toBe(false);
    });
});

describe("perfilCompletoParaRevision · regla de transición BORRADOR→EN_REVISION", () => {
    it("perfil completo + autorización aceptada → true", () => {
        expect(perfilCompletoParaRevision(PERFIL_COMPLETO as never, true)).toBe(true);
    });

    // SPEC-703: la completitud exige la ACEPTACIÓN EN PANTALLA de la versión vigente, NO el PDF.
    it("sin aceptación → false (aunque el resto esté lleno)", () => {
        expect(perfilCompletoParaRevision(PERFIL_COMPLETO as never, false)).toBe(false);
    });

    it("SPEC-703 · el archivo legacy YA NO cuenta: con archivo pero SIN aceptar → false", () => {
        expect(
            perfilCompletoParaRevision({ ...PERFIL_COMPLETO, autorizacionArchivoId: "legacy-file" } as never, false),
        ).toBe(false);
    });

    it("SPEC-703 · basta la aceptación: SIN archivo pero aceptada → true", () => {
        expect(
            perfilCompletoParaRevision({ ...PERFIL_COMPLETO, autorizacionArchivoId: null } as never, true),
        ).toBe(true);
    });

    it("sin ninguna modalidad marcada → false", () => {
        expect(
            perfilCompletoParaRevision({
                ...PERFIL_COMPLETO,
                atiendeVirtual: false,
                atiendePresencial: false,
            } as never, true)
        ).toBe(false);
    });

    // SPEC-685 (PR2): la completitud es de las LISTAS CERRADAS, no de los campos
    // libres viejos. `especialidades: []` ya NO importa; lo que gatea es
    // profesión + al menos un área + al menos un rango.
    it("sin profesión → false", () => {
        expect(perfilCompletoParaRevision({ ...PERFIL_COMPLETO, profesion: null } as never, true)).toBe(false);
    });

    it("sin ningún área de atención → false", () => {
        expect(perfilCompletoParaRevision({ ...PERFIL_COMPLETO, areasAtencion: [] } as never, true)).toBe(false);
    });

    it("sin ningún rango de edad → false", () => {
        expect(perfilCompletoParaRevision({ ...PERFIL_COMPLETO, rangoEtario: [] } as never, true)).toBe(false);
    });

    it("los campos libres viejos ya NO gatean: sin especialidades sigue completo", () => {
        expect(perfilCompletoParaRevision({ ...PERFIL_COMPLETO, especialidades: [] } as never, true)).toBe(true);
    });

    // SPEC-685 (PR2-bis): la tarifa/duración SALEN de la ficha a «Mi perfil»
    // (habilitado). Antes de estar habilitado no hay tarifa que fijar → ya NO
    // gatean el paso a EN_REVISION. Un borrador sin tarifa puede pasar a revisión.
    it("tarifa/duración 0 → sigue completo (ya no gatean; se fijan en Mi perfil)", () => {
        expect(
            perfilCompletoParaRevision({ ...PERFIL_COMPLETO, tarifaConsultaCOP: 0, duracionMinutos: 0 } as never, true),
        ).toBe(true);
    });
});
