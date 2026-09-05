/**
 * SPEC-485 (Lote-2 · Diseño) · Candado del chrome compartido (NavHeader + LandingFooter).
 *
 * El chrome está en TODAS las páginas; migró su crudo al Sistema de Diseño:
 *   - `slate/gray` → neutros (tinta/papel/`.text-muted`) · `sky` → cielo · `emerald` → pino.
 *   - `amber` (indicador de entorno/rol admin) → `ambar` / `text-estado-ambar`.
 *   - `red` del link «Cerrar sesión» → **NEUTRO** (`.text-muted` + hover `--velo`),
 *     ruling de Diseño §7.1: el logout NO es criticidad (rutinario, reversible),
 *     `rubi` se reserva a destructivo real. Consecuencia: **chrome sin ni un rojo**.
 *
 * Conducta: 0 crudo de las familias migradas en NavHeader + LandingFooter,
 * incluido `red` (el logout ya no es rojo). Verificado por mutación: reintroducir
 * `text-red-600` en el logout, o cualquier `bg-slate-*`, hace caer el candado.
 *
 * Excepción conocida (fuera del alcance de SPEC-485, flagueada al CEO): el color
 * de identidad de rol OPERADOR usa `violet-*` (borde/avatar/badge). No está en el
 * mapeo del radicado ni tiene token de diseño → queda pendiente de un ruling de
 * Diseño; por eso `violet` NO está en la lista vigilada aquí.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const MODULES = path.resolve(__dirname);
const SRC = path.resolve(__dirname, "../..");
const ARCHIVOS = [path.join(MODULES, "NavHeader.tsx"), path.join(MODULES, "LandingFooter.tsx")];

// Familias migradas por SPEC-485. `violet` queda fuera a propósito (ver cabecera).
const CRUDO = /-(slate|gray|sky|cyan|emerald|red|amber)-[0-9]{2,3}(\/[0-9]{1,3})?\b/;

describe("SPEC-485 · el chrome compartido sin crudo (cero rojo incluido)", () => {
    it("NavHeader y LandingFooter no traen crudo slate/gray/sky/cyan/emerald/red/amber", () => {
        const hits: string[] = [];
        for (const archivo of ARCHIVOS) {
            const codigo = fs.readFileSync(archivo, "utf-8");
            for (const [i, linea] of codigo.split("\n").entries()) {
                const m = linea.match(CRUDO);
                if (m) {
                    const rel = path.relative(SRC, archivo);
                    hits.push(`${rel}:${i + 1} → «${m[0]}»: ${linea.trim().slice(0, 90)}`);
                }
            }
        }
        expect(hits, `crudo reintroducido en el chrome:\n${hits.join("\n")}`).toEqual([]);
    });
});
