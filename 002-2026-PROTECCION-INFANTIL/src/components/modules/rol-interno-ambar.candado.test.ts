/**
 * SPEC-488 · identidad de rol interno de IDC en un solo acento (ámbar).
 *
 * Ruling de Diseño (§3.1 color=función): el color NO codifica el rol; los roles
 * internos de IDC comparten el acento ámbar del territorio y se distinguen por
 * NOMBRE + inicial, no por hue. Mata el `violet-` del OPERADOR (clase entera) y
 * corrige el comité (pino→ámbar).
 *
 * Conducta, muere por mutación:
 *  - 0 `violet-` en TODO src (reintroducir un `bg-violet-500` → rojo).
 *  - el badge de rol de NavHeader rinde el NOMBRE del rol (`user.rol`), no solo color.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "..", ".."); // .../src

function* recorrer(dir: string): Generator<string> {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const ruta = path.join(dir, e.name);
        if (e.isDirectory()) yield* recorrer(ruta);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) yield ruta;
    }
}

const VIOLET = /-violet-[0-9]{2,3}(\/[0-9]{1,3})?\b/;

describe("SPEC-488 · rol interno unificado en ámbar (mata el violet)", () => {
    it("0 `violet-` en todo src (el hue no codifica el rol)", () => {
        const hits: string[] = [];
        for (const archivo of recorrer(SRC)) {
            for (const [i, linea] of fs.readFileSync(archivo, "utf-8").split("\n").entries()) {
                if (VIOLET.test(linea)) hits.push(`${path.relative(SRC, archivo)}:${i + 1}: ${linea.trim().slice(0, 80)}`);
            }
        }
        expect(hits, `violet reintroducido:\n${hits.join("\n")}`).toEqual([]);
    });

    it("el badge de rol de NavHeader rinde el NOMBRE del rol (user.rol), no solo el color", () => {
        const nav = fs.readFileSync(path.join(SRC, "components/modules/NavHeader.tsx"), "utf-8");
        // Aserción LIGADA (auditoría CEO): el span que lleva `rolBadgeClass` debe
        // rendir `{user.rol...}` como texto. `/\{user\.rol/` a secas matchea los ~13
        // condicionales `{user.rol === "…"}` del nav → pasaba con el badge borrado.
        // Este patrón ata la clase del badge al nombre: borrar el badge lo pone rojo.
        expect(
            /rolBadgeClass}`}>\s*\{user\.rol/.test(nav),
            "el badge (span con rolBadgeClass) debe mostrar {user.rol} como texto — distinción por nombre, no solo color",
        ).toBe(true);
    });
});
