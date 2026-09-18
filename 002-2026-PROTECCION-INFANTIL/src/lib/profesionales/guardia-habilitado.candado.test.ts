/**
 * CANDADO · SPEC-691 · La compuerta también es de las PANTALLAS: ninguna página
 * operativa del profesional se pinta para quien no está habilitado.
 *
 * Cerrar el menú no basta: las páginas bajo `app/dashboard/profesional/**` siguen
 * alcanzables por URL directa y por el aterrizaje del login. Sin guardia, un
 * profesional sin verificar ve el Inicio operativo completo con el menú escondido
 * (hallazgo §0 de Calidad) y 403 en cadena cuando 690-B cierre la API.
 *
 * DERIVADO DEL ÁRBOL, no una lista a mano: se enumeran TODAS las `page.tsx` bajo
 * `app/dashboard/profesional/**` y se exige que cada una llame a
 * `exigirProfesionalHabilitado`. La página nueva de mañana nace cubierta o este
 * candado se pone rojo con su ruta. Control positivo del barrido: falla si no
 * encuentra las páginas conocidas (si no, pasaría en vacío).
 *
 * Control positivo de la CONDUCTA: la guardia decide contra la base
 * (`obtenerHabilitacionProfesional`, mockeada acá) — habilitado deja pasar; no
 * habilitado (cualquier estado, incl. ACTIVO+habilitado:false del worker-lag)
 * redirige al portero, NUNCA al Inicio operativo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

const { redirectMock, verifyAuthMock, habMock, necesitaAceptarMock } = vi.hoisted(() => ({
    redirectMock: vi.fn(),
    verifyAuthMock: vi.fn(),
    habMock: vi.fn(),
    necesitaAceptarMock: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/auth", () => ({ verifyAuth: verifyAuthMock }));
vi.mock("./habilitacion", () => ({ obtenerHabilitacionProfesional: habMock }));
// SPEC-686: la guardia también lleva a (re)aceptar la autorización DE FONDO.
vi.mock("@/lib/dal/services/autorizacion-profesional", () => ({
    AutorizacionProfesionalService: class {
        necesitaAceptar = necesitaAceptarMock;
    },
}));

import { exigirProfesionalHabilitado } from "./guardia-habilitado";

const APP_PROFESIONAL = path.resolve(process.cwd(), "src/app/dashboard/profesional");

/** Todas las page.tsx del área operativa del profesional (derivadas del árbol). */
function paginasOperativas(): string[] {
    const out: string[] = [];
    for (const e of fs.readdirSync(APP_PROFESIONAL, { withFileTypes: true, recursive: true })) {
        if (!e.isFile() || e.name !== "page.tsx") continue;
        const dir = (e as unknown as { parentPath?: string; path?: string }).parentPath ??
            (e as unknown as { path?: string }).path ?? APP_PROFESIONAL;
        out.push(path.join(dir, e.name));
    }
    return out;
}

const rel = (p: string) => p.slice(p.indexOf("dashboard/profesional"));

describe("SPEC-691 · toda página operativa del profesional pasa por la compuerta", () => {
    beforeEach(() => {
        redirectMock.mockClear();
        habMock.mockReset();
        verifyAuthMock.mockReset();
        verifyAuthMock.mockResolvedValue({ id: "u1", rol: "PROFESIONAL" });
        necesitaAceptarMock.mockReset();
        necesitaAceptarMock.mockResolvedValue(false);
    });

    it("CONTROL POSITIVO · el barrido encuentra las páginas operativas conocidas", () => {
        const rutas = paginasOperativas().map(rel);
        expect(rutas.length).toBeGreaterThanOrEqual(4);
        for (const esperada of [
            "dashboard/profesional/page.tsx",
            "dashboard/profesional/citaciones/page.tsx",
            "dashboard/profesional/casos/page.tsx",
            "dashboard/profesional/calendario/page.tsx",
        ]) {
            expect(rutas, `falta ${esperada} en el barrido`).toContain(esperada);
        }
    });

    it("DERIVADO DEL ÁRBOL · cada page.tsx operativa llama a exigirProfesionalHabilitado", () => {
        for (const p of paginasOperativas()) {
            const src = fs.readFileSync(p, "utf-8");
            // La LLAMADA (con paréntesis), no el identificador: un `import` suelto sin
            // invocar dejaría la página sin guardia y el candado en falso verde.
            expect(
                /exigirProfesionalHabilitado\s*\(/.test(src),
                `«${rel(p)}» no LLAMA a exigirProfesionalHabilitado() (una pantalla operativa sin guardia de estado)`,
            ).toBe(true);
        }
    });

    it("habilitado → deja pasar (no redirige)", async () => {
        habMock.mockResolvedValue({ estado: "ACTIVO", habilitado: true });
        const r = await exigirProfesionalHabilitado();
        expect(redirectMock).not.toHaveBeenCalled();
        expect(r.hab?.habilitado).toBe(true);
    });

    it("SPEC-686 · habilitado pero debe (re)aceptar la autorización DE FONDO → a la pantalla de aceptación", async () => {
        // Punto 4 del cutover: el ACTIVO con archivo acepta v0.1 en su ingreso, por la MISMA
        // compuerta (no un redirect aparte). No toca estado ni vigencia.
        habMock.mockResolvedValue({ estado: "ACTIVO", habilitado: true });
        necesitaAceptarMock.mockResolvedValue(true);
        await exigirProfesionalHabilitado();
        expect(redirectMock).toHaveBeenCalledWith("/perfil-profesional/autorizacion");
    });

    // SPEC-706: «Mi estado» (/perfil-profesional/verificacion) se retiró — su contenido es el
    // encabezado de la ficha. TODO no habilitado, en cualquier estado, va a la FICHA (una sola
    // pantalla); nunca al Inicio operativo.
    it("no habilitado → redirige SIEMPRE a la ficha (nunca al Inicio operativo)", async () => {
        const casos: Array<[unknown, string]> = [
            [null, "/perfil-profesional/completar"], // sin perfil
            [{ estado: "BORRADOR", habilitado: false }, "/perfil-profesional/completar"],
            [{ estado: "EN_REVISION", habilitado: false }, "/perfil-profesional/completar"],
            [{ estado: "VENCIDO", habilitado: false }, "/perfil-profesional/completar"],
            [{ estado: "SUSPENDIDO", habilitado: false }, "/perfil-profesional/completar"],
            [{ estado: "ACTIVO", habilitado: false }, "/perfil-profesional/completar"], // worker-lag
        ];
        for (const [hab, destino] of casos) {
            redirectMock.mockClear();
            habMock.mockResolvedValue(hab);
            await exigirProfesionalHabilitado();
            expect(redirectMock, `estado ${JSON.stringify(hab)}`).toHaveBeenCalledWith(destino);
            // y jamás deja pasar hacia una pantalla operativa
            expect(redirectMock).not.toHaveBeenCalledWith("/dashboard/profesional");
        }
    });
});
