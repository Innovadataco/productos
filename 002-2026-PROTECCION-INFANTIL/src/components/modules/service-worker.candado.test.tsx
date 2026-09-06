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

    it("registra `/sw.js`", async () => {
        render(<ServiceWorkerRegister />);
        await waitFor(() => expect(register).toHaveBeenCalledWith("/sw.js"));
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
