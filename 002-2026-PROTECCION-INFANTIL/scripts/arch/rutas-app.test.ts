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
 * Actualizado 2026-08-09: 56 page.tsx — SPEC-149 añade la configuración de
 * avisos del colegio (/dashboard/colegio/configuracion). Misma regla.
 * Actualizado 2026-08-09 (2): 57 page.tsx — SPEC-159 añade el seguimiento del
 * caso (/dashboard/colegio/alertas/[id]). Misma regla.
 * Actualizado 2026-08-10: 58 page.tsx — SPEC-153 añade la comparativa entre
 * cursos (/dashboard/colegio/analisis/comparativa). Misma regla.
 * Actualizado 2026-08-10 (2): 59 page.tsx — SPEC-154 añade la página de
 * confianza institucional (/dashboard/colegio/confianza). Misma regla.
 * Actualizado 2026-08-10 (3): 60 page.tsx — SPEC-156 añade el panel de
 * monitoreo del worker (/dashboard/admin/monitoreo/worker). Misma regla.
 * Actualizado 2026-08-12: 61 page.tsx — SPEC-162 añade la página de materias
 * (/dashboard/colegio/materias). Misma regla.
 */
import { describe, it, expect } from "vitest";
import { inventarioRutasApp, VALOR_MUESTRA_SEGMENTO } from "./lib/rutas-app";
import { RUTA_APP } from "./lib/paths";

const rutas = inventarioRutasApp(RUTA_APP);

describe("inventario de rutas del árbol src/app (SPEC-126)", () => {
    it("oráculo: 61 páginas (page.tsx) — 60 + 1 de materias del colegio (SPEC-162)", () => {
        expect(rutas.filter((r) => r.tipo === "pagina").length).toBe(61);
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
