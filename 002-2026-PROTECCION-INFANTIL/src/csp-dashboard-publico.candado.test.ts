/**
 * SPEC-531 (radicado CEO) · el CSP con nonce del área privada NO debe caer sobre la página
 * PÚBLICA prerenderizada `/dashboard-publico`. Bug PREEXISTENTE (SPEC-287, e5fe1cb27): dos
 * matchers de PREFIJO la barrían al área privada —
 *   · middleware.ts: `pathname.startsWith("/dashboard")` → le imponía el CSP con nonce;
 *   · next.config.ts: `source:"/((?!dashboard).*)"` → la excluía del CSP público estático.
 * Como su HTML se hornea sin nonce, con `strict-dynamic` el navegador bloqueaba TODOS sus
 * scripts (10 chunks + 7 inline). El área privada `/dashboard/**` es `force-dynamic`, su
 * nonce por request SÍ funciona; no estaba rota.
 *
 * Candado de CONDUCTA de los DOS matchers — muere con CUALQUIERA de las mutaciones:
 *   · volver el middleware a `startsWith("/dashboard")` → rojo (la pública recibe el nonce).
 *   · volver el next.config a `(?!dashboard)` → rojo (la pública pierde el CSP estático).
 */
import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import nextConfig from "../next.config";

function envProduccion(): () => void {
    const original = process.env.NODE_ENV;
    (process.env as { NODE_ENV: string }).NODE_ENV = "production";
    return () => {
        (process.env as { NODE_ENV: string }).NODE_ENV = original ?? "test";
    };
}

/** ¿El bloque de CSP estático (público) de next.config cubre esta ruta? */
async function cspEstaticaCubre(pathname: string): Promise<boolean> {
    const bloques = await nextConfig.headers!();
    const bloqueCsp = bloques.find((b) => b.headers.some((h) => h.key === "Content-Security-Policy"));
    if (!bloqueCsp) throw new Error("no hay bloque de Content-Security-Policy en next.config.headers()");
    // El `source` (sintaxis path-to-regexp) para este patrón —lookahead negativa + captura—
    // equivale a un regex plano anclado. Probamos la CONDUCTA de inclusión/exclusión.
    return new RegExp("^" + bloqueCsp.source + "$").test(pathname);
}

describe("SPEC-531 · el nonce del área privada no cae sobre /dashboard-publico", () => {
    let restaurar: () => void = () => undefined;
    afterEach(() => restaurar());

    it("middleware: /dashboard-publico (pública, prerenderizada) NO recibe el CSP con nonce", async () => {
        restaurar = envProduccion();
        const res = await middleware(new NextRequest("http://localhost:5005/dashboard-publico"));
        expect(
            res.headers.get("Content-Security-Policy"),
            "una página pública NUNCA debe llevar el nonce del área privada",
        ).toBeNull();
    });

    it("middleware: el área PRIVADA conserva su endurecimiento (nonce + strict-dynamic)", async () => {
        restaurar = envProduccion();
        for (const ruta of ["/dashboard", "/dashboard/admin/reportes"]) {
            const res = await middleware(new NextRequest(`http://localhost:5005${ruta}`));
            const csp = res.headers.get("Content-Security-Policy") ?? "";
            expect(csp, `${ruta} debe llevar nonce`).toContain("script-src 'self' 'nonce-");
            expect(csp, `${ruta} debe llevar strict-dynamic`).toContain("'strict-dynamic'");
        }
    });

    it("next.config: el CSP público estático CUBRE /dashboard-publico y EXCLUYE el área privada", async () => {
        expect(await cspEstaticaCubre("/dashboard-publico"), "la pública debe recibir el CSP estático").toBe(true);
        expect(await cspEstaticaCubre("/"), "las públicas normales lo reciben").toBe(true);
        expect(await cspEstaticaCubre("/dashboard"), "el área privada NO (la sirve el middleware)").toBe(false);
        expect(await cspEstaticaCubre("/dashboard/admin"), "subrutas privadas tampoco").toBe(false);
    });
});
