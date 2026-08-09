/**
 * SPEC-126 (T009): oráculos del inventario del árbol src/app/**. Sin BD.
 * Oráculo verificado 2026-07-29: 47 page.tsx.
 * Actualizado 2026-07-30: 50 page.tsx — SPEC-017 añadió 3 páginas del visor de
 * documentación (/docs, /docs/operar, /docs/tecnico). Cambio intencional:
 * prevalece el conteo real (regla de oráculos de SPEC-126).
 * Actualizado 2026-08-02: 52 page.tsx — SPEC-141 (N-1) añadió 2 páginas de solo
 * lectura del admin (circulo del padre, estructura del colegio).
 * Actualizado 2026-08-04: 53 page.tsx — SPEC-146 añade el wizard unificado
 * (/dashboard/colegio/cursos/unificado); nuevo/ y carga/ quedan como redirects
 * (siguen siendo page.tsx, por eso no restan).
 * Actualizado 2026-08-08: 54 page.tsx — SPEC-158 añade el tablero de control
 * (/dashboard/colegio/tablero).
 * Actualizado 2026-08-08 (2): 55 page.tsx — SPEC-148 añade la pantalla de
 * profesores (/dashboard/colegio/profesores). Cambio intencional: prevalece
 * el conteo real (regla de oráculos de SPEC-126).
 */
import { describe, it, expect } from "vitest";
import { inventarioRutasApp, VALOR_MUESTRA_SEGMENTO } from "./lib/rutas-app";
import { RUTA_APP } from "./lib/paths";

const rutas = inventarioRutasApp(RUTA_APP);

describe("inventario de rutas del árbol src/app (SPEC-126)", () => {
    it("oráculo: 55 páginas (page.tsx) — 54 + 1 de profesores (SPEC-148)", () => {
        expect(rutas.filter((r) => r.tipo === "pagina").length).toBe(55);
    });

    it("incluye APIs (route.ts) además de páginas", () => {
        expect(rutas.filter((r) => r.tipo === "api").length).toBeGreaterThan(50);
    });

    it("los segmentos dinámicos se evalúan con el valor muestra determinista", () => {
        const dinamicas = rutas.filter((r) => r.ruta.includes("["));
        expect(dinamicas.length).toBeGreaterThan(0);
        for (const r of dinamicas) {
            expect(r.rutaEval).not.toContain("[");
            expect(r.rutaEval).toContain(VALOR_MUESTRA_SEGMENTO);
        }
    });

    it("orden estable (doble corrida idéntica)", () => {
        const otra = inventarioRutasApp(RUTA_APP);
        expect(otra).toEqual(rutas);
    });
});
