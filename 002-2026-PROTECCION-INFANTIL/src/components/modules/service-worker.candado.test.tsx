/**
 * SPEC-533 · I-329 · CANDADO doble del modo sin conexión.
 *
 * El bug: ServiceWorkerRegister hacía `getRegistrations()→unregister()` + borraba
 * todas las cachés en cada carga (workaround permanente contra cachés obsoletas
 * post-login) → `public/sw.js` JAMÁS se instalaba y al caerse la red salía
 * ERR_INTERNET_DISCONNECTED en vez de /offline.
 *
 * Conducta vigilada (muere con el defecto en ambos sentidos):
 *  (1) El componente REGISTRA `/sw.js` y NO desregistra en masa.
 *  (2) El SW NO cachea rutas privadas (/dashboard, /login, /registro, /mis-reportes,
 *      /api/) ni payloads RSC — reponer el registro no revive el bug viejo.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";
import { ServiceWorkerRegister } from "./ServiceWorkerRegister";

describe("SPEC-533 · (1) el componente registra el SW y no desregistra", () => {
    const register = vi.fn().mockResolvedValue({});
    const getRegistrations = vi.fn().mockResolvedValue([]);

    beforeEach(() => {
        Object.defineProperty(document, "readyState", { value: "complete", configurable: true });
        Object.defineProperty(navigator, "serviceWorker", {
            value: { register, getRegistrations },
            configurable: true,
        });
        register.mockClear();
        getRegistrations.mockClear();
    });
    afterEach(() => {
        delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
    });

    it("registra `/sw.js?v=<versión>` (SPEC-906: versionado por build)", async () => {
        render(<ServiceWorkerRegister />);
        await waitFor(() => expect(register).toHaveBeenCalledWith(expect.stringMatching(/^\/sw\.js\?v=.+/)));
    });

    it("NO desregistra en masa (no llama getRegistrations)", async () => {
        render(<ServiceWorkerRegister />);
        await waitFor(() => expect(register).toHaveBeenCalled());
        expect(getRegistrations).not.toHaveBeenCalled();
    });
});

describe("SPEC-533 · (2) el SW no cachea rutas privadas ni RSC", () => {
    // Extrae y ejecuta la función real `shouldCache` de public/sw.js.
    const src = fs.readFileSync(path.resolve(__dirname, "../../../public/sw.js"), "utf-8");
    const fuente = src.match(/function shouldCache\(request\)[\s\S]*?\n}/);
    const shouldCache = eval("(" + (fuente ? fuente[0] : "function(){throw new Error('shouldCache no hallada')}") + ")") as (
        req: { method: string; url: string; headers: { get: (h: string) => string | null } },
    ) => boolean;

    const req = (pathname: string, opts: { method?: string; rsc?: boolean } = {}) => ({
        method: opts.method ?? "GET",
        url: `https://pi.test${pathname}`,
        headers: { get: (h: string) => (h === "RSC" && opts.rsc ? "1" : null) },
    });

    it("NO cachea rutas privadas", () => {
        for (const p of ["/dashboard", "/dashboard/admin", "/login", "/registro", "/mis-reportes", "/api/notificaciones"]) {
            expect(shouldCache(req(p)), `no debe cachear ${p}`).toBe(false);
        }
    });

    it("NO cachea payloads RSC ni no-GET", () => {
        expect(shouldCache(req("/", { rsc: true })), "no debe cachear RSC").toBe(false);
        expect(shouldCache(req("/reportar", { method: "POST" })), "no debe cachear no-GET").toBe(false);
    });

    it("SÍ cachea navegación pública GET (contraprueba)", () => {
        expect(shouldCache(req("/reportar")), "debe cachear /reportar público").toBe(true);
        expect(shouldCache(req("/")), "debe cachear la portada").toBe(true);
    });
});

describe("SPEC-906 · el SW se auto-actualiza por build y siempre responde", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../../../public/sw.js"), "utf-8");
    function extraer(re: RegExp): string {
        const m = src.match(re);
        if (!m) throw new Error(`no hallé el fragmento: ${re}`);
        return m[0];
    }
    type FakeCaches = { match: (k: string) => Promise<unknown>; open?: () => Promise<{ put: () => Promise<void> }> };

    it("(a) el CACHE_NAME se deriva del ?v= de la URL → cambia por build", () => {
        const versionDeLocation = eval("(" + extraer(/function versionDeLocation\(href\)[\s\S]*?\n}/) + ")") as (h: string) => string;
        expect(versionDeLocation("https://pi.test/sw.js?v=sha-aaa")).toBe("sha-aaa");
        expect(versionDeLocation("https://pi.test/sw.js?v=sha-bbb")).toBe("sha-bbb"); // build distinto → versión distinta
        expect(versionDeLocation("https://pi.test/sw.js")).toBe("sin-version");
        // y el CACHE_NAME se CONSTRUYE con esa versión (no es un literal fijo).
        expect(src).toMatch(/CACHE_NAME\s*=\s*"proteccion-infantil-"\s*\+\s*versionDeLocation\(/);
    });

    it("(b/c) responderActivo SIEMPRE devuelve un Response (éxito, caché, y fallo sin caché → NUNCA undefined)", async () => {
        const factory = eval(
            "(function(fetch, caches, CACHE_NAME){ " + extraer(/async function responderActivo[\s\S]*?\n}/) + " return responderActivo; })",
        ) as (f: unknown, c: FakeCaches, n: string) => (r: unknown) => Promise<unknown>;
        const req = { url: "https://pi.test/_next/static/chunks/x.js" };

        const okFetch = async () => new Response("js", { status: 200 });
        const cachesOk: FakeCaches = { match: async () => undefined, open: async () => ({ put: async () => {} }) };
        const rExito = (await factory(okFetch, cachesOk, "c")(req)) as { status: number };
        expect(rExito && typeof rExito.status).toBe("number");
        expect(rExito.status).toBe(200);

        const failFetch = async () => {
            throw new Error("sin red");
        };
        const rCache = (await factory(failFetch, { match: async () => new Response("cache", { status: 200 }) }, "c")(req)) as { status: number };
        expect(rCache.status).toBe(200); // fallo de red → sirve caché

        // La rama que ANTES devolvía undefined (fallo + sin caché): ahora un Response de error.
        const rFallo = (await factory(failFetch, { match: async () => undefined }, "c")(req)) as { status: number };
        expect(rFallo, "nunca undefined").toBeTruthy();
        expect(typeof rFallo.status).toBe("number");
        expect(rFallo.status).toBe(504);
    });

    it("(b/c) responderNavegacion es network-first y SIEMPRE devuelve un Response (fallo → offline/503)", async () => {
        const factory = eval(
            "(function(fetch, caches, OFFLINE_URL){ " + extraer(/async function responderNavegacion[\s\S]*?\n}/) + " return responderNavegacion; })",
        ) as (f: unknown, c: FakeCaches, o: string) => (r: unknown) => Promise<unknown>;
        const req = { url: "https://pi.test/login" };

        const okFetch = async () => new Response("<html>", { status: 200 });
        const rRed = (await factory(okFetch, { match: async () => undefined }, "/offline")(req)) as { status: number };
        expect(rRed.status).toBe(200); // network-first: sirve la red fresca

        const failFetch = async () => {
            throw new Error("sin red");
        };
        const rOffline = (await factory(failFetch, { match: async () => new Response("offline", { status: 200 }) }, "/offline")(req)) as { status: number };
        expect(rOffline.status).toBe(200); // fallo → página offline

        const rSinOffline = (await factory(failFetch, { match: async () => undefined }, "/offline")(req)) as { status: number };
        expect(rSinOffline, "nunca undefined").toBeTruthy();
        expect(rSinOffline.status).toBe(503);
    });

    it("(a/d) activate purga las cachés que NO son la actual, e install/activate hacen skipWaiting + clients.claim", () => {
        expect(src, "activate enumera cachés").toMatch(/caches\s*\.?\s*keys\(\)/);
        expect(src, "activate borra las que no son CACHE_NAME").toMatch(/key\s*!==\s*CACHE_NAME/);
        expect(src, "activate borra cachés viejas").toMatch(/caches\.delete\(/);
        expect(src, "install toma control ya").toMatch(/self\.skipWaiting\(\)/);
        expect(src, "activate reclama clientes").toMatch(/self\.clients\.claim\(\)/);
    });

    it("ya NO precachea la portada «/» (shell con chunks viejos = fuente del stale)", () => {
        const precache = extraer(/const PRECACHE = \[[^\]]*\]/);
        expect(precache).not.toMatch(/"\/"/);
        expect(precache).toMatch(/OFFLINE_URL/);
    });
});
