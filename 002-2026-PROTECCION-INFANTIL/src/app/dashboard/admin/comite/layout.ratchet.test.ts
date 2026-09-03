import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

/**
 * SPEC-381 (I-276) — Candado: la barra `<ComiteSubNav>` la monta ÚNICAMENTE
 * el layout compartido `layout.tsx` de /dashboard/admin/comite/**.
 *
 * Antes cada `page.tsx` la montaba por su cuenta en distinta posición respecto
 * al `<h1>` y saltaba entre pestañas. Con el layout compartido queda en la
 * misma coordenada Y para las 5 pantallas; este test impide que una pantalla
 * nueva vuelva a duplicarla y desincronice la posición.
 */

const REPO = path.resolve(__dirname, "..", "..", "..", "..", "..");
const COMITE_ROOT = path.join(REPO, "src", "app", "dashboard", "admin", "comite");

function leer(rel: string) {
    return fs.readFileSync(path.join(COMITE_ROOT, rel), "utf-8");
}

const PANTALLAS = [
    "page.tsx",
    "apelaciones/page.tsx",
    "gestion/page.tsx",
    "guias-pendientes/page.tsx",
    "auditoria/page.tsx",
] as const;

describe("layout compartido /comite/** (SPEC-381 · I-276)", () => {
    it("el layout.tsx monta el subnav", () => {
        const src = leer("layout.tsx");
        expect(src).toMatch(/import\s+\{\s*ComiteSubNav\s*\}/);
        expect(src).toMatch(/<ComiteSubNav\b/);
    });

    for (const rel of PANTALLAS) {
        it(`page ${rel} no monta el subnav (lo hace el layout)`, () => {
            const src = leer(rel);
            // Ni el import ni el uso: el brinco entre pestañas volvería.
            expect(src).not.toMatch(/from\s+["'][^"']*ComiteSubNav["']/);
            expect(src).not.toMatch(/<ComiteSubNav\b/);
        });
    }
});
