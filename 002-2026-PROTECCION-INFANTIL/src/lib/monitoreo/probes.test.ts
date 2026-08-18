/**
 * Tests de los probes del vigilante (SPEC-171). Los probes de red NUNCA salen
 * a servicios reales: se prueban contra un servidor HTTP efímero (node:http)
 * levantado en el propio test. `probeBd` usa la PostgreSQL de integración y
 * `probeWorker` un WORKER_RUN_DIR temporal (vi.resetModules + import dinámico).
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { probeApp, probeBd, probeOllamaPing, probeOllamaSmoke, probeTailscale } from "./probes";

type Handler = (req: IncomingMessage, res: ServerResponse, body: string) => void;

let server: Server;
let baseUrl: string;
let handler: Handler;
let ultimoBody: string | null;

beforeAll(async () => {
    handler = (_req, res) => {
        res.writeHead(200, { "Content-Type": "text/plain" }).end("ok");
    };
    server = createServer((req, res) => {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
            ultimoBody = body || null;
            handler(req, res, body);
        });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
    // Corta sockets colgados (el test de timeout deja una respuesta sin cerrar).
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
});

beforeEach(async () => {
    await resetDatabase();
    ultimoBody = null;
});

async function sembrarModelos(valor: string | null) {
    if (valor === null) return;
    await prisma.parametroSistema.upsert({
        where: { clave: "ia.rubrica.modelos" },
        update: { valor },
        create: { clave: "ia.rubrica.modelos", valor, tipo: "JSON", categoria: "SYSTEM", esPublico: false },
    });
}

describe("probeApp", () => {
    it("ok con HTTP 200 en /api/health/worker", async () => {
        const resultado = await probeApp({ url: baseUrl });
        expect(resultado.ok).toBe(true);
        expect(resultado.latenciaMs).toBeGreaterThanOrEqual(0);
    });

    it("falla con HTTP 503", async () => {
        handler = (_req, res) => res.writeHead(503).end("down");
        const resultado = await probeApp({ url: baseUrl });
        expect(resultado.ok).toBe(false);
        expect(resultado.detalle).toBe("HTTP 503");
    });

    it("falla (sin lanzar) cuando el destino no responde a tiempo", async () => {
        handler = () => {
            // Nunca responde: el AbortSignal del probe debe cortar.
        };
        const resultado = await probeApp({ url: baseUrl, timeoutMs: 150 });
        expect(resultado.ok).toBe(false);
        expect(resultado.detalle).toBeTruthy();
    });

    it("falla contra un puerto cerrado", async () => {
        const resultado = await probeApp({ url: "http://127.0.0.1:1", timeoutMs: 1000 });
        expect(resultado.ok).toBe(false);
    });
});

describe("probeOllamaPing", () => {
    it("ok con 200 en /api/tags", async () => {
        handler = (_req, res) => res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ models: [] }));
        const resultado = await probeOllamaPing({ baseUrl });
        expect(resultado.ok).toBe(true);
    });

    it("falla con 500", async () => {
        handler = (_req, res) => res.writeHead(500).end("boom");
        const resultado = await probeOllamaPing({ baseUrl });
        expect(resultado.ok).toBe(false);
        expect(resultado.detalle).toBe("HTTP 500");
    });
});

describe("probeOllamaSmoke", () => {
    it("ok: genera con el MODELO VIGENTE del motor (primer elemento de ia.rubrica.modelos)", async () => {
        await sembrarModelos(JSON.stringify(["modelo-vigente:9b", "otro:7b"]));
        handler = (_req, res) => res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ response: "ok" }));

        const resultado = await probeOllamaSmoke({ baseUrl, timeoutMs: 5000 });

        expect(resultado.ok).toBe(true);
        const body = JSON.parse(ultimoBody ?? "{}");
        expect(body).toMatchObject({ model: "modelo-vigente:9b", stream: false, options: { num_predict: 5 } });
    });

    it("falla con 'sin modelo vigente configurado' si el parámetro falta o es inválido", async () => {
        await sembrarModelos(null);
        const sinParam = await probeOllamaSmoke({ baseUrl, timeoutMs: 1000 });
        expect(sinParam.ok).toBe(false);
        expect(sinParam.detalle).toBe("sin modelo vigente configurado");

        await sembrarModelos("no-es-json");
        const invalido = await probeOllamaSmoke({ baseUrl, timeoutMs: 1000 });
        expect(invalido.ok).toBe(false);
        expect(invalido.detalle).toBe("sin modelo vigente configurado");

        await sembrarModelos(JSON.stringify([]));
        const vacio = await probeOllamaSmoke({ baseUrl, timeoutMs: 1000 });
        expect(vacio.ok).toBe(false);
        expect(vacio.detalle).toBe("sin modelo vigente configurado");
    });

    it("falla si la generación devuelve response vacío", async () => {
        await sembrarModelos(JSON.stringify(["modelo-vigente:9b"]));
        handler = (_req, res) => res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ response: "" }));

        const resultado = await probeOllamaSmoke({ baseUrl, timeoutMs: 5000 });
        expect(resultado.ok).toBe(false);
        expect(resultado.detalle).toContain("respuesta vacía");
    });

    it("falla con HTTP 500 de Ollama", async () => {
        await sembrarModelos(JSON.stringify(["modelo-vigente:9b"]));
        handler = (_req, res) => res.writeHead(500).end("boom");

        const resultado = await probeOllamaSmoke({ baseUrl, timeoutMs: 5000 });
        expect(resultado.ok).toBe(false);
        expect(resultado.detalle).toContain("HTTP 500");
    });
});

describe("probeTailscale", () => {
    it("sin URL configurada devuelve no-aplica (ok)", async () => {
        const resultado = await probeTailscale({ url: "" });
        expect(resultado.ok).toBe(true);
        expect(resultado.detalle).toBe("no-aplica");
    });

    it("ok con cualquier status < 500 (un 404 igual prueba que la punta vive)", async () => {
        handler = (_req, res) => res.writeHead(404).end("not found");
        const resultado = await probeTailscale({ url: baseUrl });
        expect(resultado.ok).toBe(true);
        expect(resultado.detalle).toBe("HTTP 404");
    });

    it("falla con status >= 500", async () => {
        handler = (_req, res) => res.writeHead(502).end("bad gateway");
        const resultado = await probeTailscale({ url: baseUrl });
        expect(resultado.ok).toBe(false);
        expect(resultado.detalle).toBe("HTTP 502");
    });
});

describe("probeBd", () => {
    it("ok contra la PostgreSQL de integración", async () => {
        const resultado = await probeBd();
        expect(resultado.ok).toBe(true);
    });
});

describe("probeWorker", () => {
    let dirTemporal: string;
    const runDirPrevio = process.env.WORKER_RUN_DIR;

    afterEach(async () => {
        if (runDirPrevio === undefined) delete process.env.WORKER_RUN_DIR;
        else process.env.WORKER_RUN_DIR = runDirPrevio;
        if (dirTemporal) await rm(dirTemporal, { recursive: true, force: true });
    });

    async function importarProbeWorkerFresco(dir: string) {
        process.env.WORKER_RUN_DIR = dir;
        vi.resetModules();
        const modulo = await import("./probes");
        return modulo.probeWorker;
    }

    it("rojo sin archivo, verde con latido fresco, rojo con latido viejo", async () => {
        dirTemporal = await mkdtemp(join(tmpdir(), "heartbeat-test-"));
        const probeWorkerFresco = await importarProbeWorkerFresco(dirTemporal);

        // Sin archivo de heartbeat → rojo.
        expect(probeWorkerFresco({ heartbeatMaxSeg: 90 }).ok).toBe(false);

        // Latido recién escrito → verde.
        await writeFile(join(dirTemporal, "worker.heartbeat"), String(Date.now()), "utf8");
        expect(probeWorkerFresco({ heartbeatMaxSeg: 90 }).ok).toBe(true);

        // Latido más viejo que el máximo → rojo con detalle de la edad.
        await writeFile(join(dirTemporal, "worker.heartbeat"), String(Date.now() - 120_000), "utf8");
        const viejo = probeWorkerFresco({ heartbeatMaxSeg: 90 });
        expect(viejo.ok).toBe(false);
        expect(viejo.detalle).toContain("sin latido hace");
    });
});
