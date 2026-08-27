/**
 * SPEC-287 (002-PI-187) · Unit tests de los 4 ratchets estáticos.
 *
 * Cada test escribe fixtures sintéticos en un dir temporal y ejercita la
 * función pura del ratchet (no el CLI, para evitar spawn de procesos).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buscarXInvokePath } from "./no-x-invoke-path";
import { buscarRedirectsEnLayouts } from "./no-redirect-en-layout-de-dashboard";
import { buscarSelfRedirects, rutaDePagina } from "./no-self-redirect-server-actions";
import { buscarUsosPrecioUSD } from "./no-usd-en-vistas-suscripcion";

let raiz: string;

beforeEach(() => {
    raiz = mkdtempSync(join(tmpdir(), "ratchets-"));
});

afterEach(() => {
    rmSync(raiz, { recursive: true, force: true });
});

// ────────────────────────────────────────────────────────────────────────────
// Ratchet 1 — no-x-invoke-path
// ────────────────────────────────────────────────────────────────────────────
describe("no-x-invoke-path", () => {
    it("caso feliz: cero archivos con el header", () => {
        mkdirSync(join(raiz, "app"));
        writeFileSync(join(raiz, "app", "ok.ts"), "const foo = 'bar';\n");
        expect(buscarXInvokePath(raiz)).toHaveLength(0);
    });

    it("detecta una ocurrencia en .ts", () => {
        writeFileSync(join(raiz, "malo.ts"), 'const p = headers().get("x-invoke-path");\n');
        const hits = buscarXInvokePath(raiz);
        expect(hits).toHaveLength(1);
        expect(hits[0].file).toContain("malo.ts");
        expect(hits[0].line).toBe(1);
    });

    it("detecta variante case-insensitive (X-Invoke-Path)", () => {
        writeFileSync(join(raiz, "malo.tsx"), 'req.headers.get("X-Invoke-Path")\n');
        expect(buscarXInvokePath(raiz)).toHaveLength(1);
    });

    it("multiples archivos con multiples ocurrencias", () => {
        writeFileSync(join(raiz, "a.ts"), 'get("x-invoke-path")\nget("x-invoke-path")\n');
        writeFileSync(join(raiz, "b.tsx"), 'get("x-invoke-path")\n');
        expect(buscarXInvokePath(raiz)).toHaveLength(3);
    });

    it("ignora archivos .md y .json", () => {
        writeFileSync(join(raiz, "readme.md"), "menciona x-invoke-path como texto\n");
        writeFileSync(join(raiz, "package.json"), '{ "x-invoke-path": true }\n');
        expect(buscarXInvokePath(raiz)).toHaveLength(0);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// Ratchet 2 — no-redirect-en-layout-de-dashboard
// ────────────────────────────────────────────────────────────────────────────
describe("no-redirect-en-layout-de-dashboard", () => {
    function crearLayout(nombreCarpeta: string, contenido: string): void {
        const dir = join(raiz, nombreCarpeta);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "layout.tsx"), contenido);
    }

    it("caso feliz: layout UI puro sin redirect", () => {
        crearLayout("padre", "import { cookies } from \"next/headers\";\nexport default function() { return <div/>; }\n");
        expect(buscarRedirectsEnLayouts(raiz)).toHaveLength(0);
    });

    it("detecta 1 redirect en un layout", () => {
        crearLayout(
            "colegio",
            "import { redirect } from \"next/navigation\";\nexport default function() { redirect(\"/login\"); }\n",
        );
        const hits = buscarRedirectsEnLayouts(raiz);
        expect(hits).toHaveLength(1);
        expect(hits[0].file).toContain("colegio/layout.tsx");
    });

    it("ignora string 'redirect(' en comentarios", () => {
        crearLayout(
            "padre",
            "// este layout NO ejecuta redirect(...)\nexport default function() { return <div/>; }\n",
        );
        expect(buscarRedirectsEnLayouts(raiz)).toHaveLength(0);
    });

    it("ignora string 'redirect(' dentro de string literal", () => {
        crearLayout(
            "padre",
            "const msg = \"no puedes redirect() aquí\";\nexport default function() { return <div>{msg}</div>; }\n",
        );
        expect(buscarRedirectsEnLayouts(raiz)).toHaveLength(0);
    });

    it("detecta múltiples redirects en múltiples layouts", () => {
        crearLayout(
            "padre",
            "import { redirect } from \"next/navigation\";\nexport default function() { redirect(\"/a\"); redirect(\"/b\"); }\n",
        );
        crearLayout(
            "colegio",
            "import { redirect } from \"next/navigation\";\nexport default function() { redirect(\"/c\"); }\n",
        );
        expect(buscarRedirectsEnLayouts(raiz)).toHaveLength(3);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// Ratchet 3 — no-self-redirect-server-actions
// ────────────────────────────────────────────────────────────────────────────
describe("no-self-redirect-server-actions", () => {
    it("rutaDePagina deriva URL correctamente", () => {
        const appDir = "/tmp/proj/src/app";
        expect(rutaDePagina("/tmp/proj/src/app/dashboard/padre/suscripcion/page.tsx", appDir)).toBe(
            "/dashboard/padre/suscripcion",
        );
        expect(rutaDePagina("/tmp/proj/src/app/dashboard/page.tsx", appDir)).toBe("/dashboard");
    });

    function crearPage(subpath: string, contenido: string): void {
        const dir = join(raiz, "app", subpath);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "page.tsx"), contenido);
    }

    it("caso feliz: action con revalidatePath, sin self-redirect", () => {
        crearPage(
            "dashboard/padre/suscripcion",
            "async function action() { \"use server\"; revalidatePath(\"/dashboard/padre/suscripcion\"); }\nexport default function() { return <div/>; }\n",
        );
        const hits = buscarSelfRedirects(join(raiz, "app"), join(raiz, "app", "dashboard"));
        expect(hits).toHaveLength(0);
    });

    it("detecta self-redirect a la misma ruta que la página", () => {
        crearPage(
            "dashboard/padre/suscripcion",
            "async function action() { \"use server\"; redirect(\"/dashboard/padre/suscripcion\"); }\nexport default function() { return <div/>; }\n",
        );
        const hits = buscarSelfRedirects(join(raiz, "app"), join(raiz, "app", "dashboard"));
        expect(hits).toHaveLength(1);
        expect(hits[0].rutaEsperada).toBe("/dashboard/padre/suscripcion");
    });

    it("NO detecta redirect a OTRA ruta (solo bloquea self)", () => {
        crearPage(
            "dashboard/padre/suscripcion",
            "async function action() { \"use server\"; redirect(\"/login\"); }\nexport default function() { return <div/>; }\n",
        );
        expect(buscarSelfRedirects(join(raiz, "app"), join(raiz, "app", "dashboard"))).toHaveLength(0);
    });

    it("NO detecta redirect fuera de bloque 'use server'", () => {
        crearPage(
            "dashboard/padre/suscripcion",
            "function nadaAction() { redirect(\"/dashboard/padre/suscripcion\"); }\nexport default function() { return <div/>; }\n",
        );
        expect(buscarSelfRedirects(join(raiz, "app"), join(raiz, "app", "dashboard"))).toHaveLength(0);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// Ratchet 5 — no-usd-en-vistas-suscripcion (SPEC-289)
// ────────────────────────────────────────────────────────────────────────────
describe("no-usd-en-vistas-suscripcion", () => {
    function crearVista(subpath: string, contenido: string): string {
        const dir = join(raiz, subpath);
        mkdirSync(dir, { recursive: true });
        const file = join(dir, "page.tsx");
        writeFileSync(file, contenido);
        return dir;
    }

    it("caso feliz: solo mención como KEY de objeto literal (permitido)", () => {
        crearVista(
            "app/dashboard/colegio/suscripcion",
            "export default function() { return { precioBaseUSD: 0, precioBaseCOP: 50000 }; }",
        );
        expect(buscarUsosPrecioUSD([join(raiz, "app/dashboard/colegio/suscripcion")])).toHaveLength(0);
    });

    it("detecta acceso a propiedad plan.precioBaseUSD", () => {
        const dir = crearVista(
            "app/dashboard/padre/suscripcion",
            "export default function() { const x: number = plan.precioBaseUSD; return x; }",
        );
        const hits = buscarUsosPrecioUSD([dir]);
        expect(hits.length).toBeGreaterThanOrEqual(1);
        expect(hits[0].text).toContain("precioBaseUSD");
    });

    it("detecta patrón destructor { precioBaseUSD }", () => {
        const dir = crearVista(
            "app/dashboard/colegio/suscripcion",
            "export default function() { const { precioBaseUSD } = plan; return precioBaseUSD; }",
        );
        expect(buscarUsosPrecioUSD([dir]).length).toBeGreaterThanOrEqual(1);
    });

    it("NO detecta strings/comentarios que mencionan precioBaseUSD", () => {
        const dir = crearVista(
            "app/dashboard/padre/suscripcion",
            "// TODO retirar precioBaseUSD en Fase 2\nexport default function() { const msg = 'no leer precioBaseUSD aquí'; return msg; }",
        );
        expect(buscarUsosPrecioUSD([dir])).toHaveLength(0);
    });

    it("directorio inexistente → sin error, cero hits", () => {
        expect(buscarUsosPrecioUSD([join(raiz, "no-existe")])).toHaveLength(0);
    });
});
