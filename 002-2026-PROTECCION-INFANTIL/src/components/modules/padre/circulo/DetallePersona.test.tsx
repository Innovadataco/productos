import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DetallePersona } from "./DetallePersona";
import type { DetalleContacto } from "./tipos";

/**
 * SPEC-370 — los dos defectos que encontró Calidad en "Ver de qué se trata":
 *  · I-264: mostraba "Sin nombre" porque el endpoint de detalle no devolvía
 *    `nombre` (la lista sí lo traía; el detalle arma el objeto a mano).
 *  · I-265: el bloque "Dónde" dependía de que hubiera COORDENADAS, así que una
 *    ciudad en texto (sin vincular al catálogo) dejaba la sección invisible.
 */
vi.mock("next/dynamic", () => ({
    default: () => function MapaFalso() {
        return <div data-testid="mapa" />;
    },
}));

function detalle(extra: Partial<DetalleContacto> = {}): DetalleContacto {
    return {
        id: "c1",
        nombre: "Carlos Tio de Prueba",
        parentesco: "Tío",
        etiqueta: null,
        nota: null,
        activo: true,
        creadoEn: "2026-08-12T10:00:00.000Z",
        estado: "enRevision",
        totalReportes: 1,
        identificadores: [
            { id: "i1", valor: "tiocarlos01", tipo: null, plataforma: null, activo: true, estado: "enRevision", totalReportes: 1 },
        ],
        agregado: {
            totalReportes: 1,
            reportesAutenticados: 1,
            reportesAnonimos: 0,
            primerReporte: null,
            ultimoReporte: null,
            plataformas: [],
            categorias: [],
            porGrupoCategoria: [{ clave: "contacto", nombre: "Contacto insistente", orden: 1, total: 1 }],
            ubicaciones: [{ pais: "Colombia", ciudad: "Bogotá", lat: null, lng: null, total: 1 }],
            timeline: [{ mes: "2026-08", total: 1 }],
        },
        ...extra,
    } as DetalleContacto;
}

const props = { guardando: false, onCerrar: vi.fn(), onCambiarDato: vi.fn() };

describe("DetallePersona · arreglos de Calidad (SPEC-370)", () => {
    it("I-264: muestra el NOMBRE de la persona, no 'Sin nombre'", () => {
        render(<DetallePersona detalle={detalle()} {...props} />);
        expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Carlos Tio de Prueba");
        expect(document.body.textContent).not.toContain("Sin nombre");
    });

    it("I-264: si el contacto es viejo y solo tiene `etiqueta`, se usa esa (sin romper)", () => {
        render(<DetallePersona detalle={detalle({ nombre: null, etiqueta: "Vecino del 3B" })} {...props} />);
        expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Vecino del 3B");
    });

    it("I-265: el bloque 'Dónde' aparece aunque la ciudad no tenga coordenadas", () => {
        render(<DetallePersona detalle={detalle()} {...props} />);
        expect(screen.getByText("Dónde")).toBeTruthy();
        expect(screen.getByText(/Bogotá/)).toBeTruthy();
        // Sin coordenadas no se puede pintar el mapa, pero la sección ya no desaparece.
        expect(screen.queryByTestId("mapa")).toBeNull();
    });

    it("I-265: con coordenadas SÍ se pinta el mapa", () => {
        const d = detalle();
        d.agregado!.ubicaciones = [{ pais: "Colombia", ciudad: "Bogotá", lat: 4.7, lng: -74.07, total: 1 }];
        render(<DetallePersona detalle={d} {...props} />);
        expect(screen.getByTestId("mapa")).toBeTruthy();
        expect(screen.getByText("Dónde")).toBeTruthy();
    });

    it("sin reportes no se inventan estadísticas", () => {
        render(<DetallePersona detalle={detalle({ agregado: null, totalReportes: 0, estado: "sinReportes" })} {...props} />);
        expect(screen.getByText(/Nadie ha reportado a Carlos Tio de Prueba/)).toBeTruthy();
        expect(screen.queryByText("Dónde")).toBeNull();
    });
});
