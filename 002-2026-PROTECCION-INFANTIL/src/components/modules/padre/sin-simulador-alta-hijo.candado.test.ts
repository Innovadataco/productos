import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * SPEC-627 (D-133) · CANDADO: el área del padre NO ofrece un «Simular reporte»,
 * y el alta de hijo NO es un wizard.
 *
 * Jelkin, mirando la pantalla: «yo no pedí que estuviera un simular reporte, eso
 * no tiene ningún sentido» + «cuatro pasos, mucho texto». D-133 deroga el wizard
 * de SPEC-599 (`RegistroHijoWizard` + su `PasoCirculoConfianza`, que tenía el
 * simulador): el alta es el formulario inline simple («una sola acción»).
 *
 * Se verifica por ÁRBOL DE RENDER, no por carpeta (lección I-375): el simulador
 * no debe ser ALCANZABLE desde la pantalla del padre. Acá se afirma en dos
 * puntos que juntos lo garantizan: (1) los archivos del wizar/simulador no
 * existen; (2) ningún fuente del área del padre —el árbol que cuelga de
 * `dashboard/padre` + `components/modules/padre`— contiene un «simular reporte».
 *
 * Muere si el simulador revive: recrear el archivo o el texto pone rojo.
 * fs-puro → unit, sin base.
 */

const SRC = path.resolve(__dirname, "..", "..", ".."); // .../src

// (1) Los archivos del wizard/simulador quedaron borrados (D-133).
const BORRADOS = [
    "components/modules/padre/registro-hijo/PasoCirculoConfianza.tsx",
    "components/modules/padre/registro-hijo/RegistroHijoWizard.tsx",
    "components/modules/padre/registro-hijo/PasoBienvenidaRegistro.tsx",
    "components/modules/padre/registro-hijo/PasoDatosHijo.tsx",
    "components/modules/padre/registro-hijo/ChipEdad.tsx",
    "components/modules/padre/registro-hijo/PreviewCirculoVivo.tsx",
    "components/modules/padre/registro-hijo/WizardStepper.tsx",
    "components/modules/padre/registro-hijo/ResumenRegistro.tsx",
];

// (2) Árbol del área del padre a barrer.
const DIRS_PADRE = [
    path.join(SRC, "app/dashboard/padre"),
    path.join(SRC, "components/modules/padre"),
];

function* recorrer(dir: string): Generator<string> {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const ruta = path.join(dir, e.name);
        if (e.isDirectory()) yield* recorrer(ruta);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) yield ruta;
    }
}

// El simulador de reportes: el texto que el padre veía y el patrón del control.
const SIMULADOR = /simular\s+reporte|reporte\s+simulado|simulador\s+de\s+reporte/i;

describe("SPEC-627 · el área del padre no ofrece «Simular reporte» ni wizard de alta", () => {
    it("(1) los archivos del wizard y su simulador están borrados (D-133)", () => {
        for (const rel of BORRADOS) {
            expect(fs.existsSync(path.join(SRC, rel)), `debería estar borrado: ${rel}`).toBe(false);
        }
    });

    it("(2) ningún fuente del área del padre contiene un «simular reporte»", () => {
        const hits: string[] = [];
        for (const dir of DIRS_PADRE) {
            for (const archivo of recorrer(dir)) {
                const codigo = fs.readFileSync(archivo, "utf-8");
                for (const [i, linea] of codigo.split("\n").entries()) {
                    if (SIMULADOR.test(linea)) {
                        hits.push(`${path.relative(SRC, archivo)}:${i + 1}: ${linea.trim().slice(0, 90)}`);
                    }
                }
            }
        }
        expect(
            hits,
            ["SPEC-627 — un «simular reporte» revivió en el área del padre:", ...hits, "",
                "Jelkin lo rechazó (D-133). Si es una herramienta interna, vive en el área interna, no acá."].join("\n"),
        ).toEqual([]);
    });

    it("(3) MisHijos monta el formulario inline, no el wizard derogado", () => {
        const mis = fs.readFileSync(path.join(SRC, "components/modules/padre/MisHijos.tsx"), "utf-8");
        // No IMPORTA el wizard (una mención en comentario que explica la baja es
        // legítima; un import no).
        expect(mis).not.toMatch(/^import[^\n]*RegistroHijoWizard/m);
        expect(mis).toMatch(/import\s*\{\s*FormularioAltaHijo\s*\}/);
    });
});
