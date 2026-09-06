/**
 * SPEC-574 (I-354) · CANDADO DE CONDUCTA — «clasificar» es el complemento de corregir/confirmar,
 * y muere en las DOS direcciones:
 *   · con un reporte en REVISION_MANUAL SIN clasificación → HAY acción para clasificar, y NO se
 *     ofrecen corregir/confirmar (que exigen clasificación).
 *   · con clasificación presente → siguen corregir/confirmar y NO aparece clasificar (donde el
 *     endpoint respondería 409 y remite a corrección: el cliente respeta el 409, no lo esquiva).
 *
 * Es conducta pura (qué acción está disponible), independiente de cómo se vea — la forma la define
 * Diseño. Mutación: quitar `!tieneClasificacion` de `puedeClasificar` → el segundo caso muere;
 * quitar el `REVISION_MANUAL` → el caso de otro estado muere.
 */
import { describe, it, expect } from "vitest";
import {
    capacidadesAccionesReporte,
    asignacionListaParaEnviar,
    type ReporteParaCapacidades,
} from "./capacidades-reporte";

function reporte(over: Partial<ReporteParaCapacidades>): ReporteParaCapacidades {
    return { eliminado: false, estado: "REVISION_MANUAL", clasificacion: null, ...over };
}

describe("SPEC-574 · capacidades de acción del operador", () => {
    it("REVISION_MANUAL SIN clasificación → HAY clasificar; NO corregir ni confirmar", () => {
        const c = capacidadesAccionesReporte(reporte({ estado: "REVISION_MANUAL", clasificacion: null }));
        expect(c.puedeClasificar, "sin clasificación, el operador debe tener la acción principal").toBe(true);
        expect(c.puedeCorregir, "corregir exige clasificación").toBe(false);
        expect(c.puedeConfirmar, "confirmar exige clasificación").toBe(false);
    });

    it("REVISION_MANUAL CON clasificación (sin corrección) → NO clasificar; SÍ corregir y confirmar", () => {
        const c = capacidadesAccionesReporte(
            reporte({ estado: "REVISION_MANUAL", clasificacion: { correccion: null } }),
        );
        expect(c.puedeClasificar, "con clasificación NO se ofrece clasificar (el endpoint daría 409)").toBe(false);
        expect(c.puedeCorregir).toBe(true);
        expect(c.puedeConfirmar).toBe(true);
    });

    it("un estado que NO es REVISION_MANUAL y sin clasificación → tampoco clasificar", () => {
        const c = capacidadesAccionesReporte(reporte({ estado: "CLASIFICADO", clasificacion: null }));
        expect(c.puedeClasificar).toBe(false);
    });

    it("reporte dado de baja → ninguna acción de clasificación/corrección", () => {
        const c = capacidadesAccionesReporte(reporte({ eliminado: true, estado: "REVISION_MANUAL", clasificacion: null }));
        expect(c.puedeClasificar).toBe(false);
        expect(c.puedeCorregir).toBe(false);
        expect(c.puedeConfirmar).toBe(false);
    });

    it("los TRES nunca coexisten: clasificar excluye a corregir/confirmar en cualquier estado", () => {
        // Diseño: el slot principal muestra SIEMPRE uno de {Corregir+Confirmar} o {Asignar}, nunca los
        // tres. Se cumple para toda combinación relevante de estado × (con/sin) clasificación.
        const escenarios: ReporteParaCapacidades[] = [
            { eliminado: false, estado: "REVISION_MANUAL", clasificacion: null },
            { eliminado: false, estado: "REVISION_MANUAL", clasificacion: { correccion: null } },
            { eliminado: false, estado: "CLASIFICADO", clasificacion: { correccion: null } },
            { eliminado: false, estado: "CORREGIDO", clasificacion: { correccion: { x: 1 } } },
            { eliminado: true, estado: "REVISION_MANUAL", clasificacion: null },
        ];
        for (const r of escenarios) {
            const c = capacidadesAccionesReporte(r);
            expect(
                c.puedeClasificar && (c.puedeCorregir || c.puedeConfirmar),
                `clasificar y corregir/confirmar no pueden estar activos a la vez: ${JSON.stringify(r)}`,
            ).toBe(false);
        }
    });
});

describe("SPEC-574 · gate anti-reflejo de «Asignar» (asignacionListaParaEnviar)", () => {
    it("sin categoría → NO listo (el botón queda deshabilitado, un Enter no dispara)", () => {
        expect(asignacionListaParaEnviar("", "una nota suficientemente larga")).toBe(false);
    });
    it("nota con < 10 caracteres (tras trim) → NO listo", () => {
        expect(asignacionListaParaEnviar("OTRO", "corta")).toBe(false);
        expect(asignacionListaParaEnviar("OTRO", "         ")).toBe(false); // solo espacios
    });
    it("categoría Y nota ≥10 → listo (el gate se abre con dos actos deliberados)", () => {
        expect(asignacionListaParaEnviar("OTRO", "motivo con más de diez caracteres")).toBe(true);
    });
});
