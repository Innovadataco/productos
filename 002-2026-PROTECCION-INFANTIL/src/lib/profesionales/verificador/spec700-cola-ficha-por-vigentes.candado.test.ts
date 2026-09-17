/**
 * SPEC-700 (I-425) · CANDADO — la cola «documentos nuevos» y la ficha del verificador
 * miran SOLO los requisitos vigentes, no las claves que quedaron en documentos o en un
 * checklist viejo. Un requisito retirado (p.ej. «otro») no debe producir un renglón muerto
 * ni un ítem que `decidir` rebote como sobrante. Invariante por FORMA, no por suerte de los
 * datos (veredicto CEO 17-09).
 */
import { describe, it, expect } from "vitest";
import { armarFilasRenovacion, proyectarChecklistVigente } from "./service";
import type { ItemChecklist, RequisitoVerificacion } from "./requisitos";

const VIGENTES: RequisitoVerificacion[] = [
    { clave: "tarjeta_profesional", nombre: "Tarjeta profesional vigente", descripcion: "" },
    { clave: "antecedentes", nombre: "Antecedentes del profesional", descripcion: "" },
    { clave: "cedula", nombre: "Cédula de ciudadanía", descripcion: "" },
];

function doc(requisitoClave: string, estado: "VIGENTE" | "EN_REVISION") {
    return { requisitoClave, estado, extension: "pdf", subidoEn: new Date("2026-09-10T00:00:00Z") };
}

describe("SPEC-700 · armarFilasRenovacion — la cola solo muestra requisitos vigentes", () => {
    const perfilConOtroHuerfano = {
        id: "perf1",
        nombreVisible: "Pro",
        usuario: { email: "p@e.local" },
        ciudad: { nombre: "Bogotá" },
        tituloProfesional: "Psicólogo",
        verificaciones: [{ venceEn: new Date("2026-12-01T00:00:00Z") }],
        documentos: [
            doc("tarjeta_profesional", "EN_REVISION"), // vigente + pendiente → SÍ
            doc("cedula", "VIGENTE"), // vigente pero sin pendiente → no entra (falta pendiente)
            doc("otro", "EN_REVISION"), // RETIRADO pero con pendiente → NO debe aparecer
        ],
    };

    it("un requisito RETIRADO con documento EN_REVISION NO aparece en la cola", () => {
        const filas = armarFilasRenovacion([perfilConOtroHuerfano] as never, VIGENTES);
        const claves = filas[0].requisitos.map((r) => r.clave);
        expect(claves).not.toContain("otro");
    });

    it("CONTROL POSITIVO · un requisito VIGENTE con documento EN_REVISION SÍ aparece", () => {
        const filas = armarFilasRenovacion([perfilConOtroHuerfano] as never, VIGENTES);
        const claves = filas[0].requisitos.map((r) => r.clave);
        expect(claves).toContain("tarjeta_profesional");
        // y solo ese (cedula no tiene pendiente; otro está retirado):
        expect(claves).toEqual(["tarjeta_profesional"]);
    });
});

describe("SPEC-700 · proyectarChecklistVigente — la ficha se pinta por los vigentes", () => {
    it("descarta una clave RETIRADA que quedó en el checklist viejo (otro)", () => {
        const ultima: Record<string, ItemChecklist> = {
            tarjeta_profesional: { estado: "CUMPLE", observacion: "ok" },
            otro: { estado: "CUMPLE", observacion: "stale" },
        };
        const proyectada = proyectarChecklistVigente(VIGENTES, ultima);
        expect(Object.keys(proyectada).sort()).toEqual(["antecedentes", "cedula", "tarjeta_profesional"]);
        expect(proyectada).not.toHaveProperty("otro");
    });

    it("preserva el estado guardado de una clave vigente y default-ea a PENDIENTE las ausentes", () => {
        const ultima: Record<string, ItemChecklist> = {
            tarjeta_profesional: { estado: "CUMPLE", observacion: "ok" },
        };
        const proyectada = proyectarChecklistVigente(VIGENTES, ultima);
        expect(proyectada.tarjeta_profesional).toEqual({ estado: "CUMPLE", observacion: "ok" });
        expect(proyectada.antecedentes).toEqual({ estado: "PENDIENTE", observacion: "" });
    });

    it("sin checklist previo → todos los vigentes en PENDIENTE", () => {
        const proyectada = proyectarChecklistVigente(VIGENTES, undefined);
        expect(Object.values(proyectada).every((i) => i.estado === "PENDIENTE")).toBe(true);
        expect(Object.keys(proyectada)).toHaveLength(3);
    });
});
