/**
 * Q-3 (002-PI-056): ratchet de la frontera del DAL. Sin BD.
 * Recorre src/** y verifica que los únicos archivos que importan "@/lib/prisma"
 * fuera de src/lib/dal/ son los heredados de prisma-directo-allowlist.json.
 * La igualdad de conjuntos obliga a ENCOGER la lista al migrar un archivo (E-8);
 * el crecimiento lo bloquea además la regla no-restricted-imports de eslint.config.mjs.
 * Excluidos por diseño: tests y e2e (siembran la BD directamente).
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { RAIZ_PRODUCTO, relativa } from "./lib/paths";
import allowlist from "./prisma-directo-allowlist.json";

const RUTA_SRC = path.join(RAIZ_PRODUCTO, "src");
const PATRON_IMPORT = /["']@\/lib\/prisma["']/;

function accesosDirectosPrisma(): string[] {
    const entradas = fs.readdirSync(RUTA_SRC, { recursive: true, withFileTypes: true });
    return entradas
        .filter((e) => e.isFile() && /\.tsx?$/.test(e.name))
        .map((e) => relativa(path.join(e.parentPath, e.name)))
        .filter(
            (rel) =>
                !rel.startsWith("src/lib/dal/") &&
                !rel.startsWith("src/lib/e2e/") &&
                !rel.includes(".test.") &&
                PATRON_IMPORT.test(fs.readFileSync(path.join(RAIZ_PRODUCTO, rel), "utf8")),
        )
        .sort();
}

const reales = accesosDirectosPrisma();
const heredados = [...allowlist.archivos].sort();

describe("frontera del DAL (Q-3): @/lib/prisma solo dentro de src/lib/dal/", () => {
    it("la allowlist está ordenada y sin duplicados", () => {
        expect(allowlist.archivos).toEqual(heredados);
        expect(new Set(allowlist.archivos).size).toBe(allowlist.archivos.length);
    });

    it("los accesos directos reales son exactamente los heredados (la lista solo se encoge)", () => {
        expect(reales).toEqual(heredados);
    });

    it("ningún archivo del DAL está en la allowlist (sería redundante)", () => {
        expect(allowlist.archivos.some((a) => a.startsWith("src/lib/dal/"))).toBe(false);
    });
});
