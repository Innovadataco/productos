/**
 * SPEC-530 (radicado CEO) · Color crudo interno. Candado de CLASE: las dos pantallas que
 * Diseño mapeó (MAPA-COLOR-CRUDO-INTERNO) — la bandeja del Comité (`ComiteBandeja`) y el
 * expediente del reporte en admin (`AdminReporteExpediente`) — NO llevan color crudo de
 * Tailwind (estado NI neutro). Todo va por token: estado → rubi/ambar/pino/cielo
 * (+ `text-estado-*`), chrome/neutro → tinta, superficie → papel. Ninguna es data-viz →
 * swap mecánico 1:1; solo la criticidad REAL queda en rubí (3 usos: el badge «Reincidencia
 * inter-ciudad» + dos `<p role="alert">`).
 *
 * Verificado por MUTACIÓN: reintroducir cualquier `bg-*-100`/`text-*-600`/`border-slate-*`
 * en cualquiera de las dos pantallas → rojo con archivo:línea. Un candado que pasa con el
 * defecto es peor que ninguno.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const MODULES = path.resolve(__dirname); // .../src/components/modules
const PANTALLAS = ["ComiteBandeja.tsx", "AdminReporteExpediente.tsx"].map((f) => path.join(MODULES, f));

// Color crudo de Tailwind — estado (rojo/rosa/ámbar/verde/azul/cyan…) Y neutro
// (slate/gray/zinc/…), incluyendo variantes direccionales (`border-l-…`, lección SPEC-490)
// y opacidad (`/40`). El sistema NO usa ninguno: estado → token semántico, chrome → tinta,
// superficie → papel.
const CRUDO =
    /\b(?:text|bg|border|ring|from|to|via|divide|fill|stroke)(?:-[ltrbxy])?-(?:red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|slate|gray|zinc|neutral|stone)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/;

describe("SPEC-530 · color crudo interno (Comité + expediente)", () => {
    it("anti-falso-verde: las dos pantallas existen, tienen cuerpo y quedaron tokenizadas", () => {
        for (const p of PANTALLAS) {
            expect(fs.existsSync(p), `falta la pantalla ${path.basename(p)}`).toBe(true);
            expect(fs.readFileSync(p, "utf-8").length, `${path.basename(p)} vacío`).toBeGreaterThan(500);
        }
        // Marcadores de que el swap SÍ ocurrió (si el scan mirara archivos equivocados, caería).
        const comite = fs.readFileSync(PANTALLAS[0], "utf-8");
        const exped = fs.readFileSync(PANTALLAS[1], "utf-8");
        expect(comite, "ComiteBandeja debe usar tokens de estado").toMatch(/text-ambar|bg-cielo\/10|text-pino/);
        expect(comite, "la criticidad real (reincidencia) queda en rubí").toMatch(/text-rubi/);
        expect(exped, "el expediente debe tokenizar chrome a tinta/papel").toMatch(/bg-tinta\/|bg-papel|border-tinta\//);
        expect(exped, "los avisos role=alert quedan en rubí de estado").toMatch(/text-estado-rubi/);
    });

    it("0 crudo (estado ni neutro) en las dos pantallas — Diseño", () => {
        const hits: string[] = [];
        for (const p of PANTALLAS) {
            fs.readFileSync(p, "utf-8")
                .split("\n")
                .forEach((linea, i) => {
                    if (CRUDO.test(linea)) hits.push(`${path.basename(p)}:${i + 1}: ${linea.trim().slice(0, 90)}`);
                });
        }
        expect(
            hits,
            [
                "SPEC-530 — color crudo en Comité/expediente (debe ir por token):",
                ...hits,
                "",
                "Estado → rubi/ambar/pino/cielo (+ text-estado-*); chrome → tinta; superficie → papel.",
                "Solo la criticidad REAL queda en rubí (reincidencia + role=alert).",
            ].join("\n"),
        ).toEqual([]);
    });
});
