/**
 * SPEC-957 (B.3) · CANDADO: el Paso 4 (cursos) del camino del colegio NO saca al
 * panel. La regla transversal del camino (FORMA-ONBOARDING §B) es que ningún paso
 * enlaza a `/dashboard/...`; las únicas salidas son Continuar y Atrás. El enlace
 * «Materias» → `/dashboard/colegio/cursos/{id}` rompía esa regla y diluía el foco
 * del paso (crear cursos).
 *
 * Muere con el defecto: reinyectar el enlace «Materias» (o cualquier `<Link>` /
 * href a `/dashboard`) en esta página lo pone rojo. Se lee el FUENTE sin comentarios
 * para no cazar las notas que mencionan la ruta vieja.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function sinComentarios(codigo: string): string {
    return codigo
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("SPEC-957 (B.3) · cursos: sin enlace «Materias» que saque del camino", () => {
    const fuente = sinComentarios(
        readFileSync(path.join(process.cwd(), "src/app/camino/colegio/cursos/page.tsx"), "utf-8"),
    );

    it("no enlaza a la ficha del curso en /dashboard (el escape «Materias»)", () => {
        expect(fuente).not.toMatch(/dashboard\/colegio\/cursos/);
    });

    it("no usa <Link> ni ningún href hacia /dashboard (regla transversal del camino)", () => {
        expect(fuente).not.toMatch(/<Link\b/);
        expect(fuente).not.toMatch(/href=\{?["'`]?\/dashboard/);
    });

    it("no queda el texto de acción «Materias» como enlace en la fila del curso", () => {
        expect(fuente).not.toMatch(/>\s*Materias\s*</);
    });
});
