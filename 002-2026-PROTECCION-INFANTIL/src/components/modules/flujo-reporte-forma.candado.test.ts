/**
 * SPEC-511 (radicado CEO) · Resto visual del flujo del reporte. Candado de CLASE:
 *
 *  (A+B) COLOR — la vista de detalle del reporte (`reporte-detalle/**`, interna:
 *        clasificación IA, acciones, revelar original) y el seguimiento público
 *        (`SeguimientoClient`) NO llevan color crudo de Tailwind (estado NI
 *        neutro). Estado/semántico → `rubi/ambar/pino/cielo` (+ `text-estado-*`);
 *        neutro → `tinta` (`border-tinta/10`, `bg-tinta/5`). NO hay data-viz por
 *        valor aquí (todo es status discreto tipo <Badge>); si Diseño decide que
 *        «Prioridad alta»/«Ráfaga» son una escala, se marcan y se exceptúan.
 *
 *  (C) SKELETON — el wizard público de reportar (`ReporteWizard`) usa el mueble
 *      Skeleton (SPEC-494) en la espera de sesión, NO un spinner de PÁGINA. El
 *      spinner-EN-BOTÓN vive dentro de <Button> y no cuenta.
 *
 * Verificado por MUTACIÓN: reintroducir `text-red-600`/`border-slate-200` en
 * cualquier archivo de color → rojo; reintroducir `animate-spin` en el wizard →
 * rojo. Un candado que pasa con el defecto es peor que ninguno.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "..", ".."); // .../src
const DIR_DETALLE = path.join(SRC, "components", "modules", "reporte-detalle");
const SEGUIMIENTO = path.join(SRC, "components", "modules", "SeguimientoClient.tsx");
const REPORTE_WIZARD = path.join(SRC, "components", "modules", "ReporteWizard.tsx");

function* recorrer(dir: string): Generator<string> {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const ruta = path.join(dir, e.name);
        if (e.isDirectory()) yield* recorrer(ruta);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) yield ruta;
    }
}

function archivosDeColor(): string[] {
    const out = [...recorrer(DIR_DETALLE)];
    if (fs.existsSync(SEGUIMIENTO)) out.push(SEGUIMIENTO);
    return out;
}

// Color crudo de Tailwind — estado (rojo/ámbar/verde/azul…) Y neutro (slate/gray),
// con variantes direccionales (`border-l-…`, lección SPEC-490). El sistema NO usa
// ninguno: todo va por token.
const CRUDO =
    /\b(?:text|bg|border|ring|from|to|via|divide|fill|stroke)(?:-[ltrbxy])?-(?:red|amber|green|emerald|yellow|rose|orange|lime|teal|blue|sky|indigo|violet|slate|gray|zinc|neutral|stone)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/;

const CLAVE = ["AccionesReporte.tsx", "ReporteDetalleInfo.tsx", "TextoOriginalPanel.tsx"];

describe("SPEC-511 · resto visual del flujo del reporte", () => {
    const archivos = archivosDeColor();

    it("el alcance resolvió los archivos de detalle + seguimiento (anti-falso-verde)", () => {
        expect(archivos.length).toBeGreaterThan(3);
        for (const c of CLAVE) {
            expect(archivos.some((a) => a.endsWith(path.sep + c) || a.endsWith("/" + c)), `falta ${c}`).toBe(true);
        }
        expect(archivos.some((a) => a.endsWith("SeguimientoClient.tsx"))).toBe(true);
    });

    it("A+B · sin color crudo (estado ni neutro) en detalle del reporte + seguimiento", () => {
        const hits: string[] = [];
        for (const archivo of archivos) {
            for (const [i, linea] of fs.readFileSync(archivo, "utf-8").split("\n").entries()) {
                if (CRUDO.test(linea)) hits.push(`${path.relative(SRC, archivo)}:${i + 1}: ${linea.trim().slice(0, 90)}`);
            }
        }
        expect(
            hits,
            [
                "SPEC-511 — color crudo en el detalle del reporte / seguimiento:",
                ...hits,
                "",
                "Estado → rubi/ambar/pino/cielo (+ text-estado-*); neutro → tinta",
                "(border-tinta/10, bg-tinta/5). Data-viz por valor NO se tokeniza: la",
                "marca Diseño.",
            ].join("\n"),
        ).toEqual([]);
    });

    it("C · el wizard de reportar usa Skeleton en la espera de sesión (no spinner de página)", () => {
        const src = fs.readFileSync(REPORTE_WIZARD, "utf-8");
        expect(src.includes("SkeletonContainer"), "ReporteWizard debe montar el mueble Skeleton").toBe(true);
        expect(
            /animate-spin/.test(src),
            "no debe quedar spinner de PÁGINA (animate-spin) en el wizard — es skeleton",
        ).toBe(false);
    });

    it("D · las señales de criticidad (prioridadAlta / esRafaga) nunca se pintan warning/ámbar — rubi/danger (Diseño)", () => {
        // prioridadAlta y esRafaga salen de la MISMA guarda (cortar:true, ráfaga/
        // doxing) = criticidad real; se distinguen por TEXTO, no por color. Diseño
        // las fija en rubi/danger en TODA pantalla — la misma señal en dos colores
        // miente con el color.
        // Alcance = las DOS pantallas del detalle del reporte que Diseño ruló
        // (ReporteDetalleInfo + IaTraceTimeline). `AdminReportesTable` pinta la
        // misma señal en color CRUDO (ráfaga ámbar): es una tabla sin tokenizar,
        // barrido aparte — escalado al CEO, no se toca piecemeal acá.
        const DIRS = [
            path.join(SRC, "components", "modules", "reporte-detalle"),
            path.join(SRC, "components", "modules", "ia"),
        ];
        const SENAL = /prioridadAlta|esRafaga|Prioridad alta|Ráfaga/;
        const AMBAR = /variant="warning"|text-estado-ambar|bg-ambar|amber-/;
        const archivos = DIRS.flatMap((d) => [...recorrer(d)]);
        // Anti-falso-verde: el scan resolvió de verdad las dos pantallas.
        expect(archivos.some((a) => a.endsWith("ReporteDetalleInfo.tsx")), "no se resolvió ReporteDetalleInfo").toBe(true);
        expect(archivos.some((a) => a.endsWith("IaTraceTimeline.tsx")), "no se resolvió IaTraceTimeline").toBe(true);
        const hits = new Set<string>();
        for (const archivo of archivos) {
            const lineas = fs.readFileSync(archivo, "utf-8").split("\n");
            lineas.forEach((linea, i) => {
                if (!SENAL.test(linea)) return;
                // Ventana ±2: la señal (booleano/label) y su color pueden estar en
                // líneas distintas (span multilínea), no solo inline como en <Badge>.
                for (let j = Math.max(0, i - 2); j <= Math.min(lineas.length - 1, i + 2); j++) {
                    if (AMBAR.test(lineas[j])) {
                        hits.add(`${path.relative(SRC, archivo)}:${j + 1} (señal en :${i + 1}): ${lineas[j].trim().slice(0, 80)}`);
                    }
                }
            });
        }
        expect(
            [...hits],
            ["SPEC-511 — criticidad (prioridadAlta/esRafaga) pintada warning/ámbar (debe ser rubi/danger):", ...hits].join("\n"),
        ).toEqual([]);
    });
});
