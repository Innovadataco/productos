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
import { buscarTimersEnWorkers, buscarInfractores } from "./no-unref-timer-nuevo";

let raiz: string;

beforeEach(() => {
    raiz = mkdtempSync(join(tmpdir(), "ratchets-"));
});

afterEach(() => {
    rmSync(raiz, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
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

// ────────────────────────────────────────────────────────────────────────────
// Ratchet 5 — no-unref-timer-nuevo (SPEC-302 · 002-PI-208 · I-147)
// ────────────────────────────────────────────────────────────────────────────
describe("no-unref-timer-nuevo", () => {
    function crearWorker(nombre: string, contenido: string) {
        writeFileSync(join(raiz, nombre), contenido);
    }

    it("caso feliz: timer manifestado no cuenta como infractor", () => {
        crearWorker("worker-ok.mjs", "setInterval(tick, 1000).unref();\n");
        const ocurrencias = buscarTimersEnWorkers(raiz);
        expect(ocurrencias).toHaveLength(1);

        const manifiesto = {
            ocurrencias: [
                { archivo: ocurrencias[0].archivo, texto: ocurrencias[0].texto, motivo: "test", justificacion: "test" },
            ],
        };
        expect(buscarInfractores(ocurrencias, manifiesto)).toHaveLength(0);
    });

    it("detecta un timer NUEVO no manifestado", () => {
        crearWorker("worker-nuevo.mjs", "setInterval(tick, 1000);\n");
        const ocurrencias = buscarTimersEnWorkers(raiz);
        const infractores = buscarInfractores(ocurrencias, { ocurrencias: [] });
        expect(infractores).toHaveLength(1);
        expect(infractores[0].texto).toBe("setInterval(tick, 1000);");
    });

    it("NO exige .unref() en la misma línea — reproduce el caso worker-notificaciones sin falso positivo", () => {
        // Réplica del patrón real: SPEC-292 (I-147) — este timer NO debe tener
        // .unref() y el ratchet naif original lo marcaba como falso positivo.
        crearWorker("worker-notificaciones.mjs", "pollInterval = setInterval(() => {\n  hacerAlgo();\n}, 1000);\n");
        const ocurrencias = buscarTimersEnWorkers(raiz);
        const manifiesto = {
            ocurrencias: [
                {
                    archivo: ocurrencias[0].archivo,
                    texto: "pollInterval = setInterval(() => {",
                    motivo: "spec-292-sin-unref-a-proposito",
                    justificacion: "I-147",
                },
            ],
        };
        expect(buscarInfractores(ocurrencias, manifiesto)).toHaveLength(0);
    });

    it("timer con .unref() varias líneas después — cubierto por texto de la línea de declaración, no por .unref() adyacente", () => {
        // Réplica del patrón real: worker-supervisor.mjs — heartbeat.unref() 7
        // líneas después de la declaración. El grep naif original lo marcaba
        // como falso positivo por no tener .unref() en la MISMA línea.
        crearWorker(
            "worker-supervisor.mjs",
            "const heartbeat = setInterval(() => {\n  tick();\n}, 15000);\nheartbeat.unref();\n"
        );
        const ocurrencias = buscarTimersEnWorkers(raiz);
        expect(ocurrencias).toHaveLength(1); // solo la línea con setInterval( cuenta, no la del .unref()
        const manifiesto = {
            ocurrencias: [
                {
                    archivo: ocurrencias[0].archivo,
                    texto: "const heartbeat = setInterval(() => {",
                    motivo: "unref-linea-posterior",
                    justificacion: "línea 128",
                },
            ],
        };
        expect(buscarInfractores(ocurrencias, manifiesto)).toHaveLength(0);
    });

    it("multiset: dos ocurrencias idénticas requieren dos entradas en el manifiesto", () => {
        crearWorker("worker-doble.mjs", "setTimeout(cb, 100);\nsetTimeout(cb, 100);\n");
        const ocurrencias = buscarTimersEnWorkers(raiz);
        expect(ocurrencias).toHaveLength(2);

        const unaSola = {
            ocurrencias: [
                { archivo: ocurrencias[0].archivo, texto: "setTimeout(cb, 100);", motivo: "test", justificacion: "test" },
            ],
        };
        expect(buscarInfractores(ocurrencias, unaSola)).toHaveLength(1);

        const dos = {
            ocurrencias: [
                { archivo: ocurrencias[0].archivo, texto: "setTimeout(cb, 100);", motivo: "test", justificacion: "test" },
                { archivo: ocurrencias[0].archivo, texto: "setTimeout(cb, 100);", motivo: "test", justificacion: "test" },
            ],
        };
        expect(buscarInfractores(ocurrencias, dos)).toHaveLength(0);
    });

    it("ignora archivos que no matchean worker-*.mjs", () => {
        crearWorker("no-es-worker.mjs", "setInterval(tick, 1000);\n");
        crearWorker("worker-helper.ts", "setInterval(tick, 1000);\n");
        expect(buscarTimersEnWorkers(raiz)).toHaveLength(0);
    });

    it("directorio inexistente → sin error, cero ocurrencias", () => {
        expect(buscarTimersEnWorkers(join(raiz, "no-existe"))).toHaveLength(0);
    });
});
