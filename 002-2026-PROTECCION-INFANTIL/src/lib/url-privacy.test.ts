import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Guard estructural (spec 091 fix): la fuga del identificador a la URL está muerta.
 * 1. La página /consulta fue eliminada (404).
 * 2. Ningún href ni router.push deja el identificador en la URL (debe dar 0).
 */

const SRC = path.resolve(__dirname, "..");

function archivos(dir: string): string[] {
    const salida: string[] = [];
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entrada.name);
        if (entrada.isDirectory()) {
            if (!["node_modules", ".next", "__pycache__"].includes(entrada.name)) {
                salida.push(...archivos(full));
            }
        } else if (/\.(ts|tsx)$/.test(entrada.name) && !entrada.name.endsWith(".test.ts") && !entrada.name.endsWith(".test.tsx")) {
            salida.push(full);
        }
    }
    return salida;
}

describe("privacidad URL del identificador (spec 091 fix)", () => {
    it("la página /consulta no existe (404)", () => {
        expect(fs.existsSync(path.join(SRC, "app", "consulta", "page.tsx"))).toBe(false);
    });

    it("ningún href deja el identificador en la URL", () => {
        const violaciones: string[] = [];
        for (const archivo of archivos(SRC)) {
            const contenido = fs.readFileSync(archivo, "utf-8");
            if (/href=\{[^}]*identificador/.test(contenido) || /href="[^"]*identificador=/.test(contenido)) {
                violaciones.push(archivo);
            }
        }
        expect(violaciones).toEqual([]);
    });

    it("ningún router.push deja el identificador en la URL", () => {
        const violaciones: string[] = [];
        for (const archivo of archivos(SRC)) {
            const contenido = fs.readFileSync(archivo, "utf-8");
            if (/router\.push\([^)]*identificador/.test(contenido)) {
                violaciones.push(archivo);
            }
        }
        expect(violaciones).toEqual([]);
    });
});
