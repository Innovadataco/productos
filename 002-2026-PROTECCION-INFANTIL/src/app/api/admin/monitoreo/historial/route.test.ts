import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";

const URL = "http://localhost:5005/api/admin/monitoreo/historial";

async function autenticarAdmin() {
    const admin = await crearUsuario("ADMIN");
    vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
    return admin;
}

describe("GET /api/admin/monitoreo/historial (SPEC-186)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("401 sin autenticación", async () => {
        vi.spyOn(auth, "verifyAuth").mockRejectedValue(new AppError("No autenticado", ERROR_CODES.AUTH_INVALID, 401));
        const res = await GET(new Request(`${URL}?senal=ollama_smoke`));
        expect(res.status).toBe(401);
    });

    it("400 si la señal no es válida", async () => {
        await autenticarAdmin();
        const res = await GET(new Request(`${URL}?senal=senal_rara`));
        expect(res.status).toBe(400);
    });

    it("devuelve probes de ollama_smoke ordenados y resumen de 24h", async () => {
        await autenticarAdmin();
        const ahora = new Date();
        const hace1h = new Date(ahora.getTime() - 60 * 60 * 1000);
        await prisma.healthProbe.createMany({
            data: [
                { senal: "ollama_smoke", ok: true, latenciaMs: 120, detalle: "smoke real", metodo: "SMOKE", creadoEn: ahora },
                { senal: "ollama_smoke", ok: true, latenciaMs: 0, detalle: "piggyback", metodo: "PIGGYBACK", creadoEn: new Date(ahora.getTime() - 5 * 60 * 1000) },
                { senal: "ollama_ping", ok: true, latenciaMs: 80, detalle: "pong", metodo: "PING", creadoEn: new Date(ahora.getTime() - 2 * 60 * 1000) },
                { senal: "ollama_smoke", ok: false, latenciaMs: 0, detalle: "timeout", metodo: "SMOKE", creadoEn: hace1h },
            ],
        });

        const res = await GET(new Request(`${URL}?senal=ollama_smoke&limite=10`));
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.items).toHaveLength(3);
        expect(body.items[0].metodo).toBe("SMOKE");
        expect(body.items[1].metodo).toBe("PIGGYBACK");
        expect(body.resumen24h).toEqual({ pings: 1, piggybacks: 1, smokes: 1, fallos: 1 });
    });

    it("respeta el límite máximo de 100", async () => {
        await autenticarAdmin();
        const res = await GET(new Request(`${URL}?senal=ollama_smoke&limite=999`));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items).toHaveLength(0);
    });

    it("resumen24h es null para señales que no son Ollama", async () => {
        await autenticarAdmin();
        const res = await GET(new Request(`${URL}?senal=app`));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items).toHaveLength(0);
        expect(body.resumen24h).toBeNull();
    });
});
