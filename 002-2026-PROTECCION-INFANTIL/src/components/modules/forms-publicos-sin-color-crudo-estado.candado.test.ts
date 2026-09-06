/**
 * SPEC-507 (radicado CEO) · Candado de CLASE: ningún FORMULARIO público lleva
 * color crudo de ESTADO (rojo/ámbar/verde de Tailwind) — la validación y los
 * avisos van SIEMPRE por token: `text-estado-rubi/-ambar/-pino` (texto, con la
 * variante ink theme-aware) y `bg-ambar/10`·`border-ambar/20` (fondos/bordes de
 * aviso, como el primitivo `<Alerta>`). Auditoría de Diseño § Público y acceso.
 *
 * Alcance DERIVADO (no lista a mano; una lista reproduce el gap):
 *  - Todos los `*Form.tsx` de `components/modules/` (top-level) — los forms de
 *    acceso/registro públicos — MENOS `ParametrosPagosForm` (admin, no público).
 *  - El flujo público de REPORTAR: `Reporte*`, `Confirmacion*`, `FechaHora*`.
 *
 * Es color de ESTADO/aviso (chrome), NO data-viz por valor (gauge/escala/heatmap):
 * eso lo marca Diseño y queda fuera. Aquí no hay ninguno de esos.
 *
 * Verificado por MUTACIÓN: reintroducir `text-red-600` en cualquier form → rojo.
 * Un candado que pasa con el defecto es peor que ninguno.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "..", ".."); // .../src
const MODULES = path.join(SRC, "components", "modules");

const EXCLUYE_FORM = /^ParametrosPagosForm\.tsx$/; // admin, no público
const ES_FORM = /Form\.tsx$/;
const ES_REPORTAR = /^(?:Reporte|Confirmacion|FechaHora).*\.tsx$/;
const ES_TEST = /\.test\.tsx?$/;

function archivosDelAlcance(): string[] {
    const entradas = fs.readdirSync(MODULES);
    return entradas
        .filter((f) => !ES_TEST.test(f))
        .filter((f) => (ES_FORM.test(f) && !EXCLUYE_FORM.test(f)) || ES_REPORTAR.test(f))
        .map((f) => path.join(MODULES, f));
}

// Color crudo de ESTADO de Tailwind (rojo/ámbar/verde y sinónimos), incluidas
// las variantes direccionales (`border-l-amber-…`) — la forma anclada dejaría
// pasar esas (lección SPEC-490). NO incluye slate/gray (neutros = otro barrido).
const CRUDO_ESTADO =
    /\b(?:text|bg|border|ring|from|to|via|divide|fill|stroke)(?:-[ltrbxy])?-(?:red|amber|green|emerald|yellow|rose|orange|lime|teal)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/;

// Guarda anti-falso-verde: el alcance debe resolver estos forms conocidos.
const CLAVE = [
    "LoginForm.tsx", "RegistroForm.tsx", "RegistroColegioForm.tsx",
    "RecuperarForm.tsx", "RestablecerForm.tsx", "VerificacionForm.tsx",
    "ReporteStepDetalle.tsx", "ConfirmacionReporte.tsx", "ReporteBloqueoRol.tsx",
];

describe("SPEC-507 · forms públicos sin color crudo de estado (validación/avisos por token)", () => {
    const archivos = archivosDelAlcance();

    it("el alcance resolvió los forms públicos conocidos (anti-falso-verde)", () => {
        expect(archivos.length).toBeGreaterThan(8);
        for (const c of CLAVE) {
            expect(
                archivos.some((a) => a.endsWith(path.sep + c) || a.endsWith("/" + c)),
                `el alcance no incluyó ${c}`,
            ).toBe(true);
        }
    });

    it("ningún form público lleva color crudo de estado (red/amber/green…)", () => {
        const hits: string[] = [];
        for (const archivo of archivos) {
            for (const [i, linea] of fs.readFileSync(archivo, "utf-8").split("\n").entries()) {
                if (CRUDO_ESTADO.test(linea)) {
                    hits.push(`${path.relative(SRC, archivo)}:${i + 1}: ${linea.trim().slice(0, 90)}`);
                }
            }
        }
        expect(
            hits,
            [
                "SPEC-507 — color crudo de estado en un form público:",
                ...hits,
                "",
                "La validación/avisos van por token: text-estado-rubi/-ambar/-pino",
                "para texto, bg-ambar/10 + border-ambar/20 para cajas de aviso (ver",
                "el primitivo <Alerta>). NO tokenices data-viz por valor: eso lo marca",
                "Diseño.",
            ].join("\n"),
        ).toEqual([]);
    });
});
