/**
 * SPEC-130 (O-1): guarda de frontera del texto del reporte.
 * Falla si un handler de API (route.ts) lee `reporte.texto` (o un select con
 * `texto: true`) SIN pasar por el helper único `descifrarTextoReporte`.
 * La regla cubre TODOS los puntos del research: cualquier ruta que toca el
 * campo debe descifrar por la capa autorizada — una omitida filtra el cifrado
 * al cliente o rompe el flujo.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const API_DIR = path.resolve(__dirname, "../app/api");
const LEE_TEXTO = /\b(?:reporte|reporteRow)\.texto\b|\btexto:\s*true\b/;
const USA_HELPER = /descifrarTextoReporte\s*\(/;

function rutasApi(dir: string): string[] {
    const salida: string[] = [];
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entrada.name);
        if (entrada.isDirectory()) {
            salida.push(...rutasApi(full));
        } else if (entrada.name === "route.ts") {
            salida.push(full);
        }
    }
    return salida;
}

describe("frontera del texto del reporte (SPEC-130, O-1)", () => {
    it("toda ruta que lee el texto lo descifra por el helper único", () => {
        const violaciones: string[] = [];
        for (const archivo of rutasApi(API_DIR)) {
            const contenido = fs.readFileSync(archivo, "utf-8");
            if (LEE_TEXTO.test(contenido) && !USA_HELPER.test(contenido)) {
                violaciones.push(path.relative(process.cwd(), archivo));
            }
        }
        expect(violaciones, violaciones.join("; ")).toEqual([]);
    });

    it("la escritura de Reporte.texto en rutas pasa por cifrarTextoReporte o el marcador D4", () => {
        // Línea a línea: una asignación `texto:` cuya operación create/update más
        // cercana es sobre Reporte DEBE usar el helper. El dataset de entrenamiento
        // es otra entidad (fuera de alcance BL-4).
        const violaciones: string[] = [];
        for (const archivo of rutasApi(API_DIR)) {
            const lineas = fs.readFileSync(archivo, "utf-8").split("\n");
            for (let i = 0; i < lineas.length; i++) {
                const linea = lineas[i];
                if (!/^\s*texto:\s*\S/.test(linea)) continue;
                const contexto = lineas.slice(Math.max(0, i - 12), i + 1);
                // Operación más cercana hacia atrás
                let operacion: "reporte" | "dataset" | "otra" = "otra";
                for (let j = contexto.length - 1; j >= 0; j--) {
                    if (/\.reporte\.(?:create|update)/.test(contexto[j])) { operacion = "reporte"; break; }
                    if (/datasetEntrenamiento\.create/.test(contexto[j])) { operacion = "dataset"; break; }
                }
                if (operacion !== "reporte") continue;
                if (!/cifrarTextoReporte|MARCADOR_TEXTO_PURGADO/.test(linea)) {
                    violaciones.push(`${path.relative(process.cwd(), archivo)}:${i + 1} ${linea.trim()}`);
                }
            }
        }
        expect(violaciones, violaciones.join("; ")).toEqual([]);
    });
});
