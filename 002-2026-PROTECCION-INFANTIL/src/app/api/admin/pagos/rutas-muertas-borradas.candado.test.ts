/**
 * SPEC-878 (I-426 · D-138) · CANDADO DE REMOCIÓN — las tres rutas admin de pagos
 * SIN pantalla ni consumidor quedan BORRADAS.
 *
 * D-138 decidió eliminar tres `route.ts` admin que respondían en prod pero a los
 * que NINGUNA UI llamaba: las páginas server-component consumen el repositorio
 * DIRECTO (`listarSolicitudesPendientes`, `listarPendientesAprobacionPago`,
 * `crearTasaCambio` vía `lib/pagos/tasas.ts`), así que estas rutas eran
 * entrypoints duplicados que nunca se cablearon a una pantalla.
 *
 * En App Router una ruta EXISTE sólo si existe su `route.ts`: el candado afirma
 * que los tres archivos (y sus carpetas) NO están. Es control positivo por
 * REMOCIÓN — hoy pasa; si alguien re-crea cualquiera de las tres, ROJO. Verificado
 * por MUTACIÓN: reponer un `route.ts` en cualquiera de las tres rutas → rojo.
 *
 * Y afirma lo que NO se tocó: `/api/admin/pagos/cita/[id]/activar` es el hermano
 * VIVO bajo `cita/` y DEBE seguir existiendo — si el borrado se lleva de más, rojo.
 *
 * Sin BD: sólo fs.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const PAGOS = __dirname; // src/app/api/admin/pagos
const existe = (rel: string) => fs.existsSync(path.join(PAGOS, rel));

/** Las tres rutas muertas que D-138 mandó borrar (relativas a .../admin/pagos). */
const RUTAS_BORRADAS = [
    "tasas",
    "solicitudes-pendientes",
    "cita/pendientes",
] as const;

describe("SPEC-878 · rutas admin de pagos muertas, borradas (I-426 · D-138)", () => {
    for (const ruta of RUTAS_BORRADAS) {
        it(`/api/admin/pagos/${ruta} NO existe (ni route.ts ni carpeta)`, () => {
            expect(existe(`${ruta}/route.ts`), `${ruta}/route.ts no debe existir`).toBe(false);
            expect(existe(ruta), `la carpeta ${ruta} no debe existir`).toBe(false);
        });
    }

    it("el hermano VIVO /api/admin/pagos/cita/[id]/activar sí se conserva", () => {
        expect(
            existe("cita/[id]/activar/route.ts"),
            "la ruta viva cita/[id]/activar/route.ts debe seguir existiendo",
        ).toBe(true);
    });
});
