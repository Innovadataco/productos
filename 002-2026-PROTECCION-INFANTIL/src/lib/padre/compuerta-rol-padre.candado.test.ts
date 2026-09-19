/**
 * CANDADO · SPEC-711 · Toda pantalla del padre pasa por la compuerta de ROL.
 *
 * Jelkin, con su cuenta de PROFESIONAL, abrió `/dashboard/padre/profesionales` y vio el
 * cascarón del padre. No es fuga —las APIs exigen PARENT— pero un rol paseándose por el
 * área de otro erosiona la separación de roles. Cerrar el menú no basta: las páginas
 * siguen alcanzables por URL directa y por el aterrizaje del login.
 *
 * DERIVADO DEL ÁRBOL, no una lista a mano: se enumeran TODAS las `page.tsx` bajo
 * `app/dashboard/padre/**` y se exige que cada una LLAME a `exigirPadre()`. La página nueva
 * de mañana nace cubierta o este candado se pone rojo con su ruta. Control positivo del
 * barrido: falla si no encuentra las páginas conocidas (si no, pasaría en vacío).
 *
 * CONDUCTA (patrón SPEC-691/690-B): PARENT pasa; cualquier otro rol se va a SU área
 * (`homeParaRol`), NUNCA a un 403. Mutación: quitar el redirect de `exigirPadre` → el test
 * «rol ≠ PARENT redirige» se pone rojo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

const { redirectMock, verifyAuthMock } = vi.hoisted(() => ({
    redirectMock: vi.fn(),
    verifyAuthMock: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/auth", () => ({ verifyAuth: verifyAuthMock }));

import { exigirPadre } from "./guardia-padre";

const APP_PADRE = path.resolve(process.cwd(), "src/app/dashboard/padre");

/** Todas las page.tsx del área del padre (derivadas del árbol). */
function paginasPadre(): string[] {
    const out: string[] = [];
    for (const e of fs.readdirSync(APP_PADRE, { withFileTypes: true, recursive: true })) {
        if (!e.isFile() || e.name !== "page.tsx") continue;
        const dir = (e as unknown as { parentPath?: string; path?: string }).parentPath ??
            (e as unknown as { path?: string }).path ?? APP_PADRE;
        out.push(path.join(dir, e.name));
    }
    return out;
}

const rel = (p: string) => p.slice(p.indexOf("dashboard/padre"));

describe("SPEC-711 · toda pantalla del padre pasa por la compuerta de rol", () => {
    beforeEach(() => {
        redirectMock.mockClear();
        verifyAuthMock.mockReset();
    });

    it("CONTROL POSITIVO · el barrido encuentra las páginas del padre conocidas", () => {
        const rutas = paginasPadre().map(rel);
        expect(rutas.length).toBeGreaterThanOrEqual(15);
        for (const esperada of [
            "dashboard/padre/page.tsx",
            "dashboard/padre/profesionales/page.tsx",
            "dashboard/padre/expedientes/page.tsx",
            "dashboard/padre/citas/page.tsx",
        ]) {
            expect(rutas, `falta ${esperada} en el barrido`).toContain(esperada);
        }
    });

    it("DERIVADO DEL ÁRBOL · cada page.tsx del padre LLAMA a exigirPadre()", () => {
        for (const p of paginasPadre()) {
            const src = fs.readFileSync(p, "utf-8");
            // La LLAMADA (con paréntesis), no el identificador: un `import` suelto sin invocar
            // dejaría la página sin compuerta y el candado en falso verde.
            expect(
                /exigirPadre\s*\(/.test(src),
                `«${rel(p)}» no LLAMA a exigirPadre() (una pantalla del padre sin compuerta de rol)`,
            ).toBe(true);
        }
    });

    it("PARENT → deja pasar (no redirige)", async () => {
        verifyAuthMock.mockResolvedValue({ id: "u1", rol: "PARENT" });
        const u = await exigirPadre();
        expect(redirectMock).not.toHaveBeenCalled();
        expect(u.rol).toBe("PARENT");
    });

    it("rol ≠ PARENT → redirige a SU área (homeParaRol), nunca a un error", async () => {
        const casos: Array<[string, string]> = [
            ["PROFESIONAL", "/dashboard/profesional"],
            ["ADMIN", "/dashboard/admin"],
            ["SCHOOL_ADMIN", "/dashboard/colegio"],
            ["VERIFICADOR", "/dashboard/admin/verificacion"],
        ];
        for (const [rol, destino] of casos) {
            redirectMock.mockClear();
            verifyAuthMock.mockResolvedValue({ id: "u1", rol });
            await exigirPadre();
            expect(redirectMock, `rol ${rol}`).toHaveBeenCalledWith(destino);
        }
    });
});
